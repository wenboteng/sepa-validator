#!/usr/bin/env node
import {
  camtConvertPath,
  camtValidatePath,
  dumps,
  formatReport,
  validatePath,
  ClientError,
} from "../lib/api.js";

const USAGE = `usage: sepa-check FILE [--json]
       sepa-check camt validate FILE [--json]
       sepa-check camt convert FILE [--format json|csv]

Validate one SEPA XML file with the free API at
https://checksepa.com/v1/validate

camt validate uses https://checksepa.com/v1/camt/validate
camt convert uses https://checksepa.com/v1/camt/convert

No API key. The three routes share one limit: 30 requests per IP per hour,
200 per UTC day, 2 MB. The file is uploaded for that request and is not stored.

  --json              print a validation report as JSON on stdout
  --format json|csv   convert output (default json)

Exit codes:
  0  the file is valid, or convert succeeded
  1  the file is invalid
  2  usage error, unreadable file, or the API could not be reached
`;

function fail(message, asJson) {
  if (asJson) process.stdout.write(dumps({ valid: false, error: message }));
  else process.stderr.write(message + "\n");
  process.exit(2);
}

function parseCamt(argv) {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    process.stdout.write(USAGE);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const command = argv[0];
  if (command !== "validate" && command !== "convert") {
    process.stderr.write(`unknown camt command: ${command}\n${USAGE}`);
    process.exit(2);
  }
  let asJson = false;
  let outputFormat = "json";
  const files = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(USAGE);
      process.exit(0);
    }
    if (arg === "--json") {
      asJson = true;
      continue;
    }
    if (arg === "--format") {
      outputFormat = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--format=")) {
      outputFormat = arg.slice("--format=".length);
      continue;
    }
    if (arg.startsWith("-")) {
      process.stderr.write(`unknown option: ${arg}\n${USAGE}`);
      process.exit(2);
    }
    files.push(arg);
  }
  if (files.length !== 1) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  if (command === "convert" && outputFormat !== "json" && outputFormat !== "csv") {
    process.stderr.write(`format must be json or csv\n${USAGE}`);
    process.exit(2);
  }
  return { command, asJson, outputFormat, file: files[0] };
}

const argv = process.argv.slice(2);
if (argv[0] === "camt") {
  const parsed = parseCamt(argv.slice(1));
  try {
    if (parsed.command === "convert") {
      process.stdout.write(await camtConvertPath(parsed.file, parsed.outputFormat));
      process.exit(0);
    }
    const result = await camtValidatePath(parsed.file);
    const name = parsed.file.split(/[\\/]/).pop() || "";
    process.stdout.write(parsed.asJson ? dumps(result) : formatReport(result, name));
    process.exit(result.valid ? 0 : 1);
  } catch (err) {
    if (err instanceof ClientError) fail(err.message, parsed.asJson);
    fail(err instanceof Error ? err.message : String(err), parsed.asJson);
  }
}

let asJson = false;
const files = [];
for (const arg of argv) {
  if (arg === "-h" || arg === "--help") {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (arg === "--json") {
    asJson = true;
    continue;
  }
  if (arg.startsWith("-")) {
    process.stderr.write(`unknown option: ${arg}\n${USAGE}`);
    process.exit(2);
  }
  files.push(arg);
}
if (files.length !== 1) {
  process.stderr.write(USAGE);
  process.exit(2);
}

try {
  const result = await validatePath(files[0]);
  const name = files[0].split(/[\\/]/).pop() || "";
  process.stdout.write(asJson ? dumps(result) : formatReport(result, name));
  process.exit(result.valid ? 0 : 1);
} catch (err) {
  if (err instanceof ClientError) fail(err.message, asJson);
  fail(err instanceof Error ? err.message : String(err), asJson);
}
