#!/usr/bin/python3 -I
"""Install beside test_deploy.py as carservice-test-preflight; never grants deployment."""
import importlib.machinery
import importlib.util
from pathlib import Path
import sys

if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise ValueError("no arguments")
        entry = Path(__file__).resolve().with_name("carservice-test-deploy")
        loader = importlib.machinery.SourceFileLoader("test_deploy", str(entry))
        spec = importlib.util.spec_from_loader(loader.name, loader)
        module = importlib.util.module_from_spec(spec)
        loader.exec_module(module)
        module.preflight()
        print("TEST preflight passed; approval, CI and operator review still required")
    except Exception:
        print("TEST preflight refused; inspect the installation privately", file=sys.stderr)
        sys.exit(1)
