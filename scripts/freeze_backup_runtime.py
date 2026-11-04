"""Explicit offline packaging step. Reads operator-staged inputs; never contacts Docker.

Run ONLY from a reviewed root-owned copy. Inputs and outputs contain secrets.
"""
import argparse
import json
from pathlib import Path
import os


def freeze(config, containers):
    if set(config.get("services", {})) != {"backend", "frontend"} or len(containers) != 2:
        raise ValueError("Exactly the staging backend/frontend are required")
    project = config.get("name")
    if not project or project.startswith("REPLACE"):
        raise ValueError("Explicit inspected project required")
    if any(config.get(k) for k in ["include", "configs", "secrets", "volumes"]):
        raise ValueError("External inputs unsupported; review packaging")
    identity = {"project": project, "services": {}}
    for live in containers:
        labels = live["Config"]["Labels"]
        service = labels.get("com.docker.compose.service")
        if labels.get("com.docker.compose.project") != project or service not in config["services"] or service in identity["services"]:
            raise ValueError("Container project/service mismatch")
        definition = config["services"][service]
        if any(definition.get(k) for k in ["env_file", "extends", "configs", "secrets", "develop"]):
            raise ValueError("Unresolved runtime dependency")
        live_env = dict(item.split("=", 1) for item in live["Config"]["Env"] if "=" in item)
        if any(str(v) != live_env.get(k) for k, v in definition.get("environment", {}).items()):
            raise ValueError("Configured environment differs from running release")
        configured = {(v["target"], v.get("source"), not v.get("read_only", False)) for v in definition.get("volumes", []) if v["type"] == "bind"}
        actual = {(v["Destination"], v["Source"], v["RW"]) for v in live["Mounts"] if v["Type"] == "bind"}
        if configured != actual or any(v["type"] != "bind" for v in definition.get("volumes", [])):
            raise ValueError("Bind mounts differ from running release")
        if any(not Path(source).is_absolute() for _, source, _ in configured):
            raise ValueError("Absolute binds required")
        networks = {name: item["NetworkID"] for name, item in live["NetworkSettings"]["Networks"].items()}
        names = {config["networks"][key]["name"] for key in definition["networks"]}
        if names != networks.keys():
            raise ValueError("Network identity mismatch")
        identity["services"][service] = {"id": live["Id"], "image": live["Image"], "networks": networks}
        # Build contexts remain in the archived reviewed source, never in operational inputs.
        definition.pop("build", None)
        definition["image"] = live["Image"]
    for key, network in list(config["networks"].items()):
        config["networks"][key] = {"name": network["name"], "external": True}
    # Compose must treat literal dollars in resolved secrets as literal dollars.
    def escape(value):
        if isinstance(value, str):
            return value.replace("$", "$$")
        if isinstance(value, list):
            return [escape(v) for v in value]
        if isinstance(value, dict):
            return {k: escape(v) for k, v in value.items()}
        return value
    return escape(config), identity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", required=True)
    args = parser.parse_args()
    os.umask(0o077)
    root = Path(args.release)
    try:
        config, identity = freeze(json.loads((root / "inputs/resolved.json").read_text()),
                                  json.loads((root / "inputs/containers.json").read_text()))
        destination = root / "compose"
        destination.mkdir(mode=0o700)  # Refuse overwriting any existing release output.
        for name, value in [("runtime.json", config), ("identity.json", identity)]:
            (destination / name).write_text(json.dumps(value, indent=2) + "\n")
        (destination / "empty.env").touch(mode=0o600)
        settings = json.loads((root / "backup-staging.json").read_text())
        settings.update(project_name=identity["project"], release=str(root), compose_dir=str(destination),
                        env_file=str(destination / "empty.env"))
        (root / "backup-staging.json").write_text(json.dumps(settings, indent=2) + "\n")
    except Exception:
        raise SystemExit("Packaging failed; inspect protected inputs without exposing secrets")
    print("Runtime packaged; review and dry-run required")


if __name__ == "__main__":
    main()
