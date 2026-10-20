import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { basename } from "node:path";

export const API_URL = "https://checksepa.com/v1/validate";
export const CAMT_VALIDATE_URL = "https://checksepa.com/v1/camt/validate";
export const CAMT_CONVERT_URL = "https://checksepa.com/v1/camt/convert";
export const WAITLIST_URL = "https://checksepa.com/api-waitlist";
export const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "sepa-validator-mcp/0.2.0 (+https://checksepa.com)";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface Finding {
  code: string;
  message: string;
  path: string;
  line: number | null;
}

export interface ValidationResult {
  valid: boolean;
  format: string | null;
  version: string | null;
  errors: Finding[];
  warnings: Finding[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function findings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  const out: Finding[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    out.push({
      code: asString(item.code) ?? "",
      message: asString(item.message) ?? "",
      path: asString(item.path) ?? asString(item.location) ?? "",
      line: typeof item.line === "number" && Number.isInteger(item.line) ? item.line : null,
    });
  }
  return out;
}

export function normalize(report: Record<string, unknown>): ValidationResult {
  const valid = typeof report.valid === "boolean" ? report.valid : report.ok === true;
  return {
    valid,
    format: asString(report.format) ?? null,
    version: asString(report.version) ?? null,
    errors: findings(report.errors),
    warnings: findings(report.warnings),
  };
}

function encodeMultipart(filename: string, bytes: Buffer): { body: Buffer; contentType: string } {
  const safeName = filename.replace(/[\r\n"]/g, "");
  const boundary = "----sepacheck" + randomBytes(12).toString("hex");
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: application/xml\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return { body: Buffer.concat([head, bytes, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function postBytes(url: string, filename: string, bytes: Buffer): Promise<Response> {
  if (bytes.length === 0) throw new ApiError("empty file");
  if (bytes.length > MAX_BYTES) throw new ApiError("file is larger than 2 MB, the API limit");
  const form = encodeMultipart(filename, bytes);
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
    throw new ApiError(`network error: ${err instanceof Error ? err.message : err}`);
  }
}

function httpFailure(response: Response, text: string): ApiError {
  const retry = response.headers.get("retry-after");
  const wait = retry ? ` Retry-After: ${retry}s.` : "";
  if (response.status === 429) {
    return new ApiError(
      `rate limit reached (HTTP 429).${wait} Free limit: 30 per IP per hour, 200 per UTC day. Waitlist: ${WAITLIST_URL}`,
    );
  }
  if (response.status === 413) {
    return new ApiError("file too large (HTTP 413). The API accepts at most 2 MB.");
  }
  return new ApiError(`HTTP ${response.status}.${wait} ${text.slice(0, 300)}`.trim());
}

async function postReport(url: string, filename: string, bytes: Buffer): Promise<ValidationResult> {
  const response = await postBytes(url, filename, bytes);
  const text = await response.text();
  if (response.status !== 200) throw httpFailure(response, text);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiError("API returned a non-JSON response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError("API returned an unexpected JSON response");
  }
  return normalize(payload as Record<string, unknown>);
}

export async function validatePath(filePath: string): Promise<ValidationResult> {
  let info;
  try {
    info = await stat(filePath);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "ENOENT") throw new ApiError(`file not found: ${filePath}`);
    throw new ApiError(`cannot read file: ${filePath}`);
  }
  if (!info.isFile()) throw new ApiError(`file not found: ${filePath}`);
  if (info.size === 0) throw new ApiError(`empty file: ${filePath}`);
  if (info.size > MAX_BYTES) throw new ApiError(`file is larger than 2 MB, the API limit: ${filePath}`);
  const bytes = await readFile(filePath);
  return postReport(API_URL, basename(filePath) || "pain.xml", bytes);
}

export async function validateXml(xml: string): Promise<ValidationResult> {
  const bytes = Buffer.from(xml, "utf8");
  return postReport(API_URL, "document.xml", bytes);
}

async function readChecked(filePath: string): Promise<{ name: string; bytes: Buffer }> {
  let info;
  try {
    info = await stat(filePath);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "ENOENT") throw new ApiError(`file not found: ${filePath}`);
    throw new ApiError(`cannot read file: ${filePath}`);
  }
  if (!info.isFile()) throw new ApiError(`file not found: ${filePath}`);
  if (info.size === 0) throw new ApiError(`empty file: ${filePath}`);
  if (info.size > MAX_BYTES) throw new ApiError(`file is larger than 2 MB, the API limit: ${filePath}`);
  return { name: basename(filePath) || "document.xml", bytes: await readFile(filePath) };
}

export async function camtValidatePath(filePath: string): Promise<ValidationResult> {
  const file = await readChecked(filePath);
  return postReport(CAMT_VALIDATE_URL, file.name, file.bytes);
}

export async function camtValidateXml(xml: string): Promise<ValidationResult> {
  return postReport(CAMT_VALIDATE_URL, "document.xml", Buffer.from(xml, "utf8"));
}

export async function camtConvertPath(filePath: string, outputFormat: "json" | "csv"): Promise<unknown> {
  const file = await readChecked(filePath);
  return camtConvertBytes(file.name, file.bytes, outputFormat);
}

export async function camtConvertXml(xml: string, outputFormat: "json" | "csv"): Promise<unknown> {
  return camtConvertBytes("document.xml", Buffer.from(xml, "utf8"), outputFormat);
}

async function camtConvertBytes(filename: string, bytes: Buffer, outputFormat: "json" | "csv"): Promise<unknown> {
  const response = await postBytes(`${CAMT_CONVERT_URL}?format=${outputFormat}`, filename, bytes);
  const text = await response.text();
  if (response.status !== 200) throw httpFailure(response, text);
  if (outputFormat === "csv") return { format: "csv", csv: text };
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiError("API returned a non-JSON response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError("API returned an unexpected JSON response");
  }
  return payload;
}
