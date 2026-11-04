"""Call the public checksepa.com validator API."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

API_URL = "https://checksepa.com/v1/validate"
CAMT_VALIDATE_URL = "https://checksepa.com/v1/camt/validate"
CAMT_CONVERT_URL = "https://checksepa.com/v1/camt/convert"
WAITLIST_URL = "https://checksepa.com/api-waitlist"
DOCS_URL = "https://checksepa.com/docs"
CAMT_DOCS_URL = "https://checksepa.com/camt"
MAX_BYTES = 2 * 1024 * 1024
USER_AGENT = "sepa-check/0.2.1 (+https://checksepa.com)"
TIMEOUT = (10, 120)


class ClientError(Exception):
    """Usage, network, or HTTP failure. The CLI exits 2."""


def content_type_for(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".xml"):
        return "application/xml"
    return "application/octet-stream"


HINTS = {
    "XSD": "The file does not match the official schema. Check the namespace version (.001.02 or .001.08) and the element named in the message.",
    "XSD-REQUIRED": "A required element is missing. Add the child named in the message.",
    "XSD-UNEXPECTED": "This element is not allowed here. Bank-specific extensions are not in the ISO schema this check uses.",
    "XSD-TYPE": "A value has the wrong type, length, or pattern.",
    "XSD-VERSION": "This message version is not checked. camt.053 and camt.054 use .001.02 or .001.08. pain.008 is not supported.",
    "XSD-PARSE": "The file is not well-formed XML, so the check stopped.",
    "EPC-IBAN": "Use a compact IBAN with no spaces. It has to pass the ISO 13616 mod-97 check.",
    "EPC-CTRLSUM": "CtrlSum must equal the sum of the instructed amounts in that block.",
    "EPC-NBOFTXS": "NbOfTxs must equal the number of credit-transfer transactions in that block.",
}


def hint_for(code: Any, api_hint: Any) -> str:
    if isinstance(code, str) and code in HINTS:
        return HINTS[code]
    if isinstance(api_hint, str) and api_hint.strip():
        return api_hint.strip()
    return ""


def _finding(item: dict[str, Any]) -> dict[str, Any]:
    code = item.get("code") if isinstance(item.get("code"), str) else ""
    message = item.get("message") if isinstance(item.get("message"), str) else ""
    path = item.get("path") if isinstance(item.get("path"), str) else ""
    if not path and isinstance(item.get("location"), str):
        path = item["location"]
    line = item.get("line") if isinstance(item.get("line"), int) else None
    return {"code": code, "message": message, "path": path, "line": line, "hint": hint_for(code, item.get("hint"))}


def _findings(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [_finding(item) for item in value if isinstance(item, dict)]


def normalize(report: dict[str, Any]) -> dict[str, Any]:
    """Keep the public POST /v1/validate shape.

    ``valid``, ``format``, ``version``, ``errors``, and ``warnings``. Each
    finding has ``code``, ``message``, ``path``, and ``line``.
    """
    valid = report.get("valid")
    if not isinstance(valid, bool):
        valid = report.get("ok") is True
    format_name = report.get("format") if isinstance(report.get("format"), str) else None
    version = report.get("version") if isinstance(report.get("version"), str) else None
    return {
        "valid": valid,
        "format": format_name,
        "version": version,
        "errors": _findings(report.get("errors")),
        "warnings": _findings(report.get("warnings")),
    }


def format_report(result: dict[str, Any], filename: str = "") -> str:
    lines: list[str] = []
    status = "valid" if result.get("valid") else "invalid"
    lines.append(f"{status}: {filename}".rstrip())
    if result.get("format"):
        lines.append(f"format: {result['format']}")
    if result.get("version"):
        lines.append(f"version: {result['version']}")
    errors = result.get("errors") or []
    warnings = result.get("warnings") or []
    lines.append(f"errors: {len(errors)}")
    lines.append(f"warnings: {len(warnings)}")
    for item in list(errors) + list(warnings):
        lines.append("")
        bits = [str(item.get("code") or "(no code)")]
        if item.get("path"):
            bits.append(str(item["path"]))
        if item.get("line"):
            bits.append(f"line {item['line']}")
        lines.append(" ".join(bits))
        if item.get("message"):
            lines.append(f"  message: {item['message']}")
        if item.get("hint"):
            lines.append(f"  hint: {item['hint']}")
    return "\n".join(lines) + "\n"


def dumps(result: dict[str, Any]) -> str:
    return json.dumps(result, ensure_ascii=False, indent=2) + "\n"


def validate_path(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ClientError(f"file not found: {path}")
    size = path.stat().st_size
    if size == 0:
        raise ClientError(f"empty file: {path}")
    if size > MAX_BYTES:
        raise ClientError(f"file is larger than 2 MB, the API limit: {path}")
    return validate_bytes(path.name, path.read_bytes(), content_type_for(path.name))


def _post_file(url: str, filename: str, data: bytes, content_type: str) -> Any:
    if not data:
        raise ClientError("empty file")
    if len(data) > MAX_BYTES:
        raise ClientError("file is larger than 2 MB, the API limit")
    import requests

    try:
        return requests.post(
            url,
            files={"file": (filename, data, content_type)},
            headers={"User-Agent": USER_AGENT, "Accept": "application/json, text/csv"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        raise ClientError(f"network error: {exc}") from exc


def validate_bytes(filename: str, data: bytes, content_type: str, url: str = API_URL) -> dict[str, Any]:
    response = _post_file(url, filename, data, content_type)
    if response.status_code != 200:
        raise ClientError(_http_error(response))
    try:
        payload = response.json()
    except ValueError as exc:
        raise ClientError("API returned a non-JSON response") from exc
    if not isinstance(payload, dict):
        raise ClientError("API returned an unexpected JSON response")
    return normalize(payload)


def camt_validate_path(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ClientError(f"file not found: {path}")
    size = path.stat().st_size
    if size == 0:
        raise ClientError(f"empty file: {path}")
    if size > MAX_BYTES:
        raise ClientError(f"file is larger than 2 MB, the API limit: {path}")
    return validate_bytes(path.name, path.read_bytes(), content_type_for(path.name), CAMT_VALIDATE_URL)


def camt_convert_path(path: Path, output_format: str = "json") -> str:
    if output_format not in ("json", "csv"):
        raise ClientError("format must be json or csv")
    if not path.is_file():
        raise ClientError(f"file not found: {path}")
    size = path.stat().st_size
    if size == 0:
        raise ClientError(f"empty file: {path}")
    if size > MAX_BYTES:
        raise ClientError(f"file is larger than 2 MB, the API limit: {path}")
    response = _post_file(
        f"{CAMT_CONVERT_URL}?format={output_format}",
        path.name,
        path.read_bytes(),
        content_type_for(path.name),
    )
    if response.status_code != 200:
        raise ClientError(_http_error(response))
    if output_format == "csv":
        text = response.text
        return text if text.endswith("\n") else text + "\n"
    try:
        payload = response.json()
    except ValueError as exc:
        raise ClientError("API returned a non-JSON response") from exc
    return dumps(payload)


def _http_error(response: Any) -> str:
    retry = response.headers.get("Retry-After")
    body = (response.text or "").strip().replace("\n", " ")
    if len(body) > 500:
        body = body[:500] + "…"
    if response.status_code == 429:
        wait = f" Retry-After: {retry}s." if retry else ""
        return (
            f"rate limit reached (HTTP 429).{wait} "
            f"Free limit: 30 per IP per hour, 200 per UTC day. Waitlist: {WAITLIST_URL}. {body}"
        ).strip()
    if response.status_code == 413:
        return f"file too large (HTTP 413). The API accepts at most 2 MB. {body}".strip()
    extra = f" Retry-After: {retry}s." if retry else ""
    return f"HTTP {response.status_code}.{extra} Docs: {DOCS_URL}. {body}".strip()
