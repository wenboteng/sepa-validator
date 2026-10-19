"""Argument parsing and process exit codes for sepa-check."""

from __future__ import annotations

import sys
from pathlib import Path

from sepa_check.client import ClientError, dumps, format_report, validate_path

USAGE = """\
usage: sepa-check FILE [--json]

Validate one SEPA XML file with the free API at
https://checksepa.com/v1/validate

No API key. Limits: 30 requests per IP per hour, 200 per UTC day, 2 MB.
The file is uploaded for that request and is not stored.

  --json    print the report as JSON on stdout

Exit codes:
  0  the file is valid
  1  the file is invalid
  2  usage error, unreadable file, or the API could not be reached
"""


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    as_json = False
    files: list[str] = []
    for arg in argv:
        if arg in ("-h", "--help"):
            sys.stdout.write(USAGE)
            return 0
        if arg == "--json":
            as_json = True
            continue
        if arg.startswith("-"):
            sys.stderr.write(f"unknown option: {arg}\n{USAGE}")
            return 2
        files.append(arg)
    if len(files) != 1:
        sys.stderr.write(USAGE)
        return 2
    path = Path(files[0])
    try:
        result = validate_path(path)
    except ClientError as exc:
        if as_json:
            sys.stdout.write(dumps({"valid": False, "error": str(exc)}))
        else:
            sys.stderr.write(f"{exc}\n")
        return 2
    sys.stdout.write(dumps(result) if as_json else format_report(result, path.name))
    return 0 if result["valid"] else 1
