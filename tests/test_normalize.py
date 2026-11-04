import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cli" / "src"))
os.environ.setdefault("PYTHONPATH", str(ROOT / "cli" / "src"))

from sepa_check.client import format_report, normalize  # noqa: E402


class NormalizeTests(unittest.TestCase):
    def test_keeps_the_public_shape(self):
        result = normalize(
            {
                "valid": False,
                "format": "pain.001",
                "version": "pain.001.001.03",
                "errors": [
                    {
                        "code": "EPC-IBAN",
                        "message": "IBAN failed the ISO 13616 mod-97 check.",
                        "path": "/Document/CstmrCdtTrfInitn/PmtInf[1]/CdtTrfTxInf[1]/CdtrAcct/Id/IBAN",
                        "line": 50,
                    }
                ],
                "warnings": [],
            }
        )
        self.assertIs(result["valid"], False)
        self.assertEqual(result["format"], "pain.001")
        self.assertEqual(result["errors"][0]["line"], 50)
        text = format_report(result, "invalid.xml")
        self.assertIn("invalid: invalid.xml", text)
        self.assertIn("line 50", text)
        self.assertIn("EPC-IBAN", text)
        self.assertIn("hint: Use a compact IBAN", text)

    def test_line_null_stays_null(self):
        result = normalize(
            {
                "valid": False,
                "format": "pain.008",
                "version": "pain.008.001.02",
                "errors": [{"code": "XSD-VERSION", "message": "direct debit", "path": "/Document", "line": None}],
                "warnings": [{"code": "EPC-SVCLVL", "message": "missing", "path": "/Document", "line": None}],
            }
        )
        self.assertIsNone(result["errors"][0]["line"])
        self.assertEqual(result["warnings"][0]["code"], "EPC-SVCLVL")


if __name__ == "__main__":
    unittest.main()
