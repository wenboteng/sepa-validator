import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cli" / "src"


def run_cli(*args):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SRC)
    return subprocess.run(
        [sys.executable, "-m", "sepa_check", *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )


class CliOfflineTests(unittest.TestCase):
    def test_help(self):
        proc = run_cli("--help")
        self.assertEqual(proc.returncode, 0)
        self.assertIn("https://checksepa.com/v1/validate", proc.stdout)

    def test_missing_file(self):
        proc = run_cli("no-such-pain.xml")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("file not found", proc.stderr)

    def test_camt_help_and_missing_file(self):
        help_proc = run_cli("camt", "--help")
        self.assertEqual(help_proc.returncode, 0)
        self.assertIn("https://checksepa.com/v1/camt/validate", help_proc.stdout)
        self.assertIn("https://checksepa.com/v1/camt/convert", help_proc.stdout)

        missing = run_cli("camt", "validate", "no-such-camt.xml")
        self.assertEqual(missing.returncode, 2)
        self.assertIn("file not found", missing.stderr)

        convert = run_cli("camt", "convert", "no-such-camt.xml", "--format", "csv")
        self.assertEqual(convert.returncode, 2)
        self.assertIn("file not found", convert.stderr)

        bad = run_cli("camt", "convert", "no-such-camt.xml", "--format", "pdf")
        self.assertEqual(bad.returncode, 2)
        self.assertIn("json or csv", bad.stderr)

    def test_empty_file_does_not_call_the_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "empty.xml"
            path.write_bytes(b"")
            proc = run_cli(str(path))
        self.assertEqual(proc.returncode, 2)
        self.assertIn("empty file", proc.stderr)


if __name__ == "__main__":
    unittest.main()
