import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../dist/api.js";

test("normalize keeps the public report shape", () => {
  const result = normalize({
    valid: false,
    format: "pain.001",
    version: "pain.001.001.03",
    errors: [
      {
        code: "EPC-CTRLSUM",
        message: "CtrlSum is 999.00 but the transactions sum to 175.50.",
        path: "/Document/CstmrCdtTrfInitn/GrpHdr/CtrlSum",
        line: 8,
      },
    ],
    warnings: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.format, "pain.001");
  assert.equal(result.errors[0].code, "EPC-CTRLSUM");
  assert.equal(result.errors[0].line, 8);
  assert.deepEqual(result.warnings, []);
});

test("a null line stays null", () => {
  const result = normalize({
    valid: false,
    format: "camt.053",
    version: "camt.053.001.02",
    errors: [{ code: "XSD-VERSION", message: "unsupported", path: "/Document", line: null }],
    warnings: [],
  });
  assert.equal(result.errors[0].line, null);
  assert.equal(result.format, "camt.053");
});
