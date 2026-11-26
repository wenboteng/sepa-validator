import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export const API_URL = "https://checksepa.com/v1/validate";
export const CAMT_VALIDATE_URL = "https://checksepa.com/v1/camt/validate";
export const CAMT_CONVERT_URL = "https://checksepa.com/v1/camt/convert";
export const WAITLIST_URL = "https://checksepa.com/api-waitlist";

// Shown when the free limit is hit (HTTP 429). utm_* and ref let the site count clicks.
export const API_PRO_URL = "https://checksepa.com/docs?utm_source=cli&utm_medium=429&utm_campaign=api_pro#paid-offers";

function withRef(url, ref) {
  try {
    const u = new URL(url);
    u.searchParams.set("ref", ref);
    return u.toString();
  } catch {
    return url;
  }
}

/** Text for a 429: the server message plus a link to buy an API Pro key. */
export function rateLimitMessage(text, retry, ref = "cli") {
  const wait = retry ? ` Retry-After: ${retry}s.` : "";
  let data = null;
  try {
    data = JSON.parse(text || "");
  } catch {
    data = null;
  }
  const message = data && typeof data.message === "string" ? data.message.trim() : "";
  const serverUrl =
    data && typeof data.upgrade_url === "string" && data.upgrade_url.startsWith("https://") ? data.upgrade_url : "";
  const upgrade = serverUrl ? withRef(serverUrl, ref) : API_PRO_URL;
  if (serverUrl && message.includes(serverUrl)) {
    return `rate limit reached (HTTP 429).${wait} ${message.replace(serverUrl, upgrade)}`;
  }
  return `rate limit reached (HTTP 429).${wait} ${message || "Free limit: 30 per IP per hour, 200 per UTC day."}\nGet an API Pro key (EUR 19/month, 5,000 calls per month): ${upgrade}`;
}
export const DOCS_URL = "https://checksepa.com/docs";
export const CAMT_DOCS_URL = "https://checksepa.com/camt";
export const MAX_BYTES = 2 * 1024 * 1024;
export const USER_AGENT = "sepa-check/0.2.0 (+https://checksepa.com)";

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

async function postFile(url, filename, bytes, contentType) {
  if (!bytes || bytes.length === 0) throw new ClientError("empty file");
  if (bytes.length > MAX_BYTES) throw new ClientError("file is larger than 2 MB, the API limit");
  const form = encodeMultipart(filename, bytes, contentType);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/csv",
        "User-Agent": USER_AGENT,
        "Content-Type": form.contentType,
      },
      body: form.body,
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    throw new ClientError(`network error: ${err instanceof Error ? err.message : err}`);
  }
}

async function readJsonReport(response) {
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
  return payload;
}

export async function validateBytes(filename, bytes, contentType, url = API_URL) {
  const response = await postFile(url, filename, bytes, contentType);
  return normalize(await readJsonReport(response));
}

export async function camtValidatePath(filePath) {
  const { name, bytes } = await readChecked(filePath);
  return validateBytes(name, bytes, contentTypeFor(name), CAMT_VALIDATE_URL);
}

export async function camtConvertPath(filePath, outputFormat = "json") {
  if (outputFormat !== "json" && outputFormat !== "csv") throw new ClientError("format must be json or csv");
  const { name, bytes } = await readChecked(filePath);
  const response = await postFile(
    `${CAMT_CONVERT_URL}?format=${outputFormat}`,
    name,
    bytes,
    contentTypeFor(name),
  );
  const text = await response.text();
  if (response.status !== 200) throw new ClientError(httpError(response, text));
  if (outputFormat === "csv") return text.endsWith("\n") ? text : text + "\n";
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ClientError("API returned a non-JSON response");
  }
  return dumps(payload);
}

async function readChecked(filePath) {
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
  return { name: filePath.split(/[\\/]/).pop() || "document.xml", bytes: await readFile(filePath) };
}

function httpError(response, text) {
  const retry = response.headers.get("retry-after");
  let body = (text || "").trim().replace(/\s+/g, " ");
  if (body.length > 500) body = body.slice(0, 500) + "…";
  if (response.status === 429) {
    return rateLimitMessage(text, retry, "cli");
  }
  if (response.status === 413) {
    return `file too large (HTTP 413). The API accepts at most 2 MB. ${body}`.trim();
  }
  const extra = retry ? ` Retry-After: ${retry}s.` : "";
  return `HTTP ${response.status}.${extra} Docs: ${DOCS_URL}. ${body}`.trim();
}
