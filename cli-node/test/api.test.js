import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formatReport, normalize } from "../lib/api.js";

const bin = fileURLToPath(new URL("../bin/sepa-check.js", import.meta.url));

test("keeps code, path, and line", () => {
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
  assert.match(formatReport(result, "invalid.xml"), /EPC-CTRLSUM \/Document\/CstmrCdtTrfInitn\/GrpHdr\/CtrlSum line 8/);
});

test("help and a missing file do not need the network", () => {
  const help = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /checksepa.com\/v1\/validate/);

  const missing = spawnSync(process.execPath, [bin, "no-such-pain.xml"], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /file not found/);

  const dir = mkdtempSync(join(tmpdir(), "sepa-check-"));
  const empty = join(dir, "empty.xml");
  writeFileSync(empty, "");
  const emptyRun = spawnSync(process.execPath, [bin, empty], { encoding: "utf8" });
  assert.equal(emptyRun.status, 2);
  assert.match(emptyRun.stderr, /empty file/);
});

test("camt subcommand help and a missing file do not need the network", () => {
  const help = spawnSync(process.execPath, [bin, "camt", "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /checksepa.com\/v1\/camt\/validate/);
  assert.match(help.stdout, /checksepa.com\/v1\/camt\/convert/);

  const missing = spawnSync(process.execPath, [bin, "camt", "validate", "no-such-camt.xml"], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /file not found/);

  const convert = spawnSync(process.execPath, [bin, "camt", "convert", "no-such-camt.xml", "--format", "csv"], {
    encoding: "utf8",
  });
  assert.equal(convert.status, 2);
  assert.match(convert.stderr, /file not found/);
});
