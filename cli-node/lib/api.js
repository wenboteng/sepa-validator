import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export const API_URL = "https://checksepa.com/v1/validate";
export const WAITLIST_URL = "https://checksepa.com/api-waitlist";
export const DOCS_URL = "https://checksepa.com/docs";
export const MAX_BYTES = 2 * 1024 * 1024;
export const USER_AGENT = "sepa-check/0.1.0 (+https://checksepa.com)";

export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientError";
  }
}

export function contentTypeFor(name) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".xml")) return "application/xml";
  return "application/octet-stream";
}

function finding(item) {
  const path = typeof item.path === "string" && item.path
    ? item.path
    : typeof item.location === "string"
      ? item.location
      : "";
  return {
    code: typeof item.code === "string" ? item.code : "",
    message: typeof item.message === "string" ? item.message : "",
    path,
    line: Number.isInteger(item.line) ? item.line : null,
  };
}

function findings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map(finding);
}

export function normalize(report) {
  let valid = report.valid;
  if (typeof valid !== "boolean") valid = report.ok === true;
  return {
    valid,
    format: typeof report.format === "string" ? report.format : null,
    version: typeof report.version === "string" ? report.version : null,
    errors: findings(report.errors),
    warnings: findings(report.warnings),
  };
}

export function formatReport(result, filename = "") {
  const lines = [];
  const status = result.valid ? "valid" : "invalid";
  lines.push(`${status}: ${filename}`.trimEnd());
  if (result.format) lines.push(`format: ${result.format}`);
  if (result.version) lines.push(`version: ${result.version}`);
  const errors = result.errors || [];
  const warnings = result.warnings || [];
  lines.push(`errors: ${errors.length}`);
  lines.push(`warnings: ${warnings.length}`);
  for (const item of [...errors, ...warnings]) {
    lines.push("");
    const bits = [item.code || "(no code)"];
    if (item.path) bits.push(item.path);
    if (item.line) bits.push(`line ${item.line}`);
    lines.push(bits.join(" "));
    if (item.message) lines.push(`  message: ${item.message}`);
  }
  return lines.join("\n") + "\n";
}

export function dumps(result) {
  return JSON.stringify(result, null, 2) + "\n";
}

function encodeMultipart(filename, bytes, contentType) {
  const safeName = String(filename).replace(/[\r\n"]/g, "");
  const boundary = "----sepacheck" + randomBytes(12).toString("hex");
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    body: Buffer.concat([head, bytes, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function validatePath(filePath) {
  let info;
  try {
    info = await stat(filePath);
  } catch (err) {
    if (err && err.code === "ENOENT") throw new ClientError(`file not found: ${filePath}`);
    throw new ClientError(`cannot read file: ${filePath}`);
  }
  if (!info.isFile()) throw new ClientError(`file not found: ${filePath}`);
  if (info.size === 0) throw new ClientError(`empty file: ${filePath}`);
  if (info.size > MAX_BYTES) throw new ClientError(`file is larger than 2 MB, the API limit: ${filePath}`);
  const bytes = await readFile(filePath);
  const name = filePath.split(/[\\/]/).pop() || "pain.xml";
  return validateBytes(name, bytes, contentTypeFor(name));
}

export async function validateBytes(filename, bytes, contentType) {
  if (!bytes || bytes.length === 0) throw new ClientError("empty file");
  if (bytes.length > MAX_BYTES) throw new ClientError("file is larger than 2 MB, the API limit");
  const form = encodeMultipart(filename, bytes, contentType);
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "Content-Type": form.contentType,
      },
      body: form.body,
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    throw new ClientError(`network error: ${err instanceof Error ? err.message : err}`);
  }
  const text = await response.text();
  if (response.status !== 200) throw new ClientError(httpError(response, text));
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ClientError("API returned a non-JSON response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ClientError("API returned an unexpected JSON response");
  }
  return normalize(payload);
}

function httpError(response, text) {
  const retry = response.headers.get("retry-after");
  let body = (text || "").trim().replace(/\s+/g, " ");
  if (body.length > 500) body = body.slice(0, 500) + "…";
  if (response.status === 429) {
    const wait = retry ? ` Retry-After: ${retry}s.` : "";
    return `rate limit reached (HTTP 429).${wait} Free limit: 30 per IP per hour, 200 per UTC day. Waitlist: ${WAITLIST_URL}. ${body}`.trim();
  }
  if (response.status === 413) {
    return `file too large (HTTP 413). The API accepts at most 2 MB. ${body}`.trim();
  }
  const extra = retry ? ` Retry-After: ${retry}s.` : "";
  return `HTTP ${response.status}.${extra} Docs: ${DOCS_URL}. ${body}`.trim();
}
