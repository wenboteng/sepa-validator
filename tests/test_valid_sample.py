"""Live calls against the published samples. Skips when offline."""

import json
import os
import socket
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cli" / "src"
VALID = ROOT / "samples" / "valid-pain001-001-03.xml"
VALID_09 = ROOT / "samples" / "valid-pain001-001-09.xml"
INVALID = ROOT / "samples" / "invalid-pain001-001-03.xml"


def online():
    try:
        connection = socket.create_connection(("checksepa.com", 443), timeout=5)
    except OSError:
        return False
    connection.close()
    return True


def run(path: Path):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SRC)
    return subprocess.run(
        [sys.executable, "-m", "sepa_check", str(path), "--json"],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=120,
    )


class LiveSampleTest(unittest.TestCase):
    def setUp(self):
        if not online():
            self.skipTest("offline; skipped live API call")

    def test_valid_03_exits_zero(self):
        proc = run(VALID)
        self.assertEqual(proc.returncode, 0, proc.stderr or proc.stdout)
        report = json.loads(proc.stdout)
        self.assertIs(report["valid"], True)
        self.assertEqual(report["format"], "pain.001")
        self.assertEqual(report["version"], "pain.001.001.03")
        self.assertEqual(report["errors"], [])

    def test_valid_09_exits_zero(self):
        proc = run(VALID_09)
        self.assertEqual(proc.returncode, 0, proc.stderr or proc.stdout)
        report = json.loads(proc.stdout)
        self.assertIs(report["valid"], True)
        self.assertEqual(report["version"], "pain.001.001.09")

    def test_invalid_03_exits_one(self):
        proc = run(INVALID)
        self.assertEqual(proc.returncode, 1, proc.stderr or proc.stdout)
        report = json.loads(proc.stdout)
        self.assertIs(report["valid"], False)
        codes = [item["code"] for item in report["errors"]]
        self.assertIn("EPC-CTRLSUM", codes)
        self.assertIn("EPC-IBAN", codes)
        ctrl = next(item for item in report["errors"] if item["code"] == "EPC-CTRLSUM")
        self.assertEqual(ctrl["line"], 8)


if __name__ == "__main__":
    unittest.main()
