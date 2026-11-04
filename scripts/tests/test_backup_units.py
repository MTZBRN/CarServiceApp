"""Portable unit contract checks; not a substitute for systemd-analyze verify."""
import configparser
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


class UnitTests(unittest.TestCase):
    def test_service_recovery_budget_and_config(self):
        unit = configparser.ConfigParser(interpolation=None)
        unit.optionxform = str
        unit.read(ROOT / "ops/systemd/carserviceapp-backup.service")
        service = unit["Service"]
        self.assertEqual(service["Type"], "oneshot")
        self.assertEqual(service["KillMode"], "mixed")
        self.assertEqual(service["User"], "root")
        self.assertNotIn("Install", unit)
        c = json.loads((ROOT / "ops/backup-staging.json").read_text())
        self.assertIn(c["release"] + "/scripts/orchestrate_backup.py", service["ExecStart"])
        self.assertIn("-I -S -B", service["ExecStart"])
        self.assertEqual(service["WorkingDirectory"], c["release"])
        self.assertEqual(service["ReadOnlyPaths"], "/opt/carserviceapp/backup-runtime")
        recovery = 3*c["start_timeout"] + 2*(c["health_timeout"]+31) + 40
        self.assertGreaterEqual(int(service["TimeoutStopSec"].removesuffix("min"))*60, recovery)
        self.assertGreater(int(service["TimeoutStartSec"].removesuffix("min"))*60,
                           recovery + c["backup_timeout"] + 3*c["stop_timeout"] + 80)

    def test_timer_is_only_opt_in_no_catchup(self):
        unit = configparser.ConfigParser(interpolation=None)
        unit.optionxform = str
        unit.read(ROOT / "ops/systemd/carserviceapp-backup.timer")
        timer = unit["Timer"]
        self.assertEqual(timer["Unit"], "carserviceapp-backup.service")
        self.assertEqual(timer["OnCalendar"], "*-*-* 03:00:00 Europe/Budapest")
        self.assertEqual(timer["Persistent"], "false")
        self.assertNotIn("OnBootSec", timer)
        self.assertNotIn("OnStartupSec", timer)


if __name__ == "__main__":
    unittest.main()
