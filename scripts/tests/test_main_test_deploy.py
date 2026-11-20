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


class MainDeploymentTests(unittest.TestCase):
    def test_only_approved_current_main_tip_reaches_ci(self):
        policy = {"branch": "main", "revision": SHA}
        for branch, approved_sha, current, allowed in (
            ("main", SHA, SHA, True),
            ("test-deploy", SHA, SHA, False),
            ("main", OTHER_SHA, SHA, False),
            ("main", SHA, OTHER_SHA, False),
        ):
            approval = {"branch": branch, "revision": approved_sha}
            with self.subTest(approval=approval, current=current):
                with patch.object(deploy, "check_activation"), patch.object(deploy, "trusted"), \
                     patch.object(Path, "read_text", return_value=json.dumps(approval)), \
                     patch.object(deploy, "run", side_effect=["", current, "commit"]) as command, \
                     patch.object(deploy, "check_ci") as ci:
                    if allowed:
                        deploy.check_release(["git"], SHA, Path("approved.json"), policy)
                        command.assert_any_call("git", "fetch", "--no-tags", "origin",
                                                "+refs/heads/main:refs/remotes/origin/main")
                        ci.assert_called_once_with(SHA)
                    else:
                        with self.assertRaises(deploy.Refused):
                            deploy.check_release(["git"], SHA, Path("approved.json"), policy)
                        ci.assert_not_called()

    def test_missing_activation_refuses_before_remote_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(deploy, "ETC", Path(directory)), patch.object(deploy, "run") as command:
                with self.assertRaisesRegex(deploy.Refused, "deployment is disabled"):
                    deploy.check_release(["git"], SHA, Path("approved.json"), {})
                command.assert_not_called()

    def test_ci_requires_successful_push_for_exact_main_sha(self):
        success = dict(head_sha=SHA, head_branch="main", event="push",
                       status="completed", conclusion="success")
        for change in ({}, {"head_sha": OTHER_SHA}, {"head_branch": "test-deploy"},
                       {"event": "pull_request"}, {"status": "in_progress"}, {"conclusion": "failure"}):
            with self.subTest(change=change):
                response = json.dumps({"workflow_runs": [{**success, **change}]})
                with patch.object(deploy, "trusted"), patch.object(Path, "read_text", return_value="fictional"), \
                     patch.object(deploy, "run", return_value=response) as command:
                    if change:
                        with self.assertRaises(deploy.Refused):
                            deploy.check_ci(SHA)
                    else:
                        deploy.check_ci(SHA)
                    self.assertIn(f"worksheet-ci.yml/runs?branch=main&event=push&head_sha={SHA}",
                                  command.call_args.args[-1])

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
