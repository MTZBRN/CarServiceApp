"""Exercise the installed main revision contract without network or Docker."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import test_deploy as deploy


SHA = "a" * 40
OTHER_SHA = "b" * 40
TREE = "c" * 40
POLICY = {
    "mode": "continuous-test-v1", "branch": "main", "storage_layout": "test-root-v1",
    "migrations_tree": TREE, "migrations": ["001_Fictional"],
    **dict.fromkeys(("frozen_compose_sha256", "compose_sha256", "env_sha256"), "d" * 64),
}


class MainDeploymentTests(unittest.TestCase):
    def test_standing_policy_allows_successive_tips_but_rejects_stale_tip_or_changed_tree(self):
        for sha, current, tree, allowed in (
            (SHA, SHA, TREE, True),
            (OTHER_SHA, OTHER_SHA, TREE, True),
            (SHA, OTHER_SHA, TREE, False),
            (SHA, SHA, OTHER_SHA, False),
        ):
            with self.subTest(sha=sha, current=current, tree=tree):
                with patch.object(deploy, "check_activation"), \
                     patch.object(deploy, "read_continuous_policy", return_value=POLICY), \
                     patch.object(deploy, "validate_configuration_approval"), \
                     patch.object(deploy, "run", side_effect=["", current, "commit", tree, "tree"]) as command, \
                     patch.object(deploy, "check_ci") as ci:
                    if allowed:
                        deploy.check_release(["git"], sha, Path("continuous-policy.json"), POLICY, Path("frozen"))
                        command.assert_any_call("git", "fetch", "--no-tags", "origin",
                                                "+refs/heads/main:refs/remotes/origin/main")
                        command.assert_any_call("git", "rev-parse", "--verify", f"{sha}:{deploy.MIGRATIONS_PATH}")
                        ci.assert_called_once_with(sha)
                    else:
                        with self.assertRaises(deploy.Refused):
                            deploy.check_release(["git"], sha, Path("continuous-policy.json"), POLICY, Path("frozen"))
                        ci.assert_not_called()

    def test_only_explicit_standing_policy_is_accepted(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(deploy, "trusted"):
            path = Path(directory) / "continuous-policy.json"
            with self.assertRaises(FileNotFoundError):
                deploy.read_continuous_policy(path)
            path.write_text(json.dumps(POLICY))
            self.assertEqual(deploy.read_continuous_policy(path), POLICY)
            for invalid in ({"branch": "main", "revision": SHA}, {**POLICY, "branch": "test-deploy"},
                            {**POLICY, "revision": SHA}, {**POLICY, "migrations": []},
                            {**POLICY, "migrations_tree": "invalid"}, {**POLICY, "env_sha256": "invalid"}):
                with self.subTest(policy=invalid):
                    path.write_text(json.dumps(invalid))
                    with self.assertRaises(deploy.Refused):
                        deploy.read_continuous_policy(path)

    def test_policy_or_configuration_change_prevents_release(self):
        for current in ({**POLICY, "migrations_tree": OTHER_SHA}, POLICY):
            with self.subTest(policy=current), patch.object(deploy, "check_activation"), \
                 patch.object(deploy, "read_continuous_policy", return_value=current), \
                 patch.object(deploy, "trusted"), patch.object(deploy.storage, "safe_path"), \
                 patch.object(deploy.storage, "digest", return_value="wrong"), patch.object(deploy, "run") as command:
                with self.assertRaises(deploy.Refused):
                    deploy.check_release(["git"], SHA, Path("continuous-policy.json"), POLICY, Path("frozen"))
                command.assert_not_called()

    def test_missing_activation_refuses_before_remote_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(deploy, "ETC", Path(directory)), patch.object(deploy, "run") as command:
                with self.assertRaisesRegex(deploy.Refused, "deployment is disabled"):
                    deploy.check_release(["git"], SHA, Path("continuous-policy.json"), POLICY, Path("frozen"))
                command.assert_not_called()

    def test_ci_requires_successful_push_for_exact_main_sha(self):
        success = dict(head_sha=SHA, head_branch="main", event="push",
                       status="completed", conclusion="success")
        for change in ({}, {"head_sha": OTHER_SHA}, {"head_branch": "test-deploy"},
                       {"event": "pull_request"}, {"status": "in_progress"}, {"conclusion": "failure"}):
            with self.subTest(change=change):
                response = json.dumps({"workflow_runs": [{**success, **change}]})
                with patch.object(deploy, "trusted"), patch.object(Path, "read_text", return_value="fictional"), \
                     patch.object(deploy, "run", side_effect=[
                         json.dumps({"protected": True, "commit": {"sha": SHA}}), response,
                     ]) as command:
                    if change:
                        with self.assertRaises(deploy.Refused):
                            deploy.check_ci(SHA)
                    else:
                        deploy.check_ci(SHA)
                    self.assertIn(f"worksheet-ci.yml/runs?branch=main&event=push&head_sha={SHA}",
                                  command.call_args.args[-1])

    def test_github_branch_must_still_be_protected_and_current(self):
        for protected, tip in ((False, SHA), (True, OTHER_SHA)):
            with self.subTest(protected=protected, tip=tip), patch.object(deploy, "trusted"), \
                 patch.object(Path, "read_text", return_value="fictional"), patch.object(
                     deploy, "run", return_value=json.dumps({"protected": protected, "commit": {"sha": tip}})
                 ) as command:
                with self.assertRaisesRegex(deploy.Refused, "protected main tip"):
                    deploy.check_ci(SHA)
                self.assertEqual(command.call_count, 1)

    def test_automatic_deployment_requires_identical_migration_history(self):
        expected = POLICY["migrations"]
        with patch.object(deploy, "migration_state", return_value=expected):
            self.assertEqual(deploy.verify_migration_history(expected), expected)
        for history in ([], [*expected, "002_Fictional"]):
            with self.subTest(history=history), patch.object(deploy, "migration_state", return_value=history):
                with self.assertRaises(deploy.Refused):
                    deploy.verify_migration_history(expected)

    def test_healthy_revision_cannot_be_replayed(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            journal = state / ("1" * 32 + ".json")
            journal.write_text(json.dumps({"stage": "healthy", "revision": SHA}))
            (state / ("1" * 32 + ".images.json")).write_text("{}")
            with patch.object(deploy, "STATE", state), patch.object(deploy, "trusted"):
                with self.assertRaisesRegex(deploy.Refused, "already deployed"):
                    deploy.check_not_deployed(SHA)
                deploy.check_not_deployed(OTHER_SHA)


if __name__ == "__main__":
    unittest.main()
