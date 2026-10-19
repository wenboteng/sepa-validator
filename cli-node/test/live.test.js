import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";

const bin = fileURLToPath(new URL("../bin/sepa-check.js", import.meta.url));
const sample = fileURLToPath(new URL("../../samples/valid-pain001-001-03.xml", import.meta.url));

function online() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "checksepa.com", port: 443, timeout: 5000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

test("valid sample exits zero against the live API", async (t) => {
  if (!(await online())) {
    t.skip("offline; skipped live API call");
    return;
  }
  const proc = spawnSync(process.execPath, [bin, sample, "--json"], { encoding: "utf8", timeout: 120000 });
  assert.equal(proc.status, 0, proc.stderr || proc.stdout);
  const report = JSON.parse(proc.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.format, "pain.001");
  assert.equal(report.version, "pain.001.001.03");
  assert.deepEqual(report.errors, []);
});
