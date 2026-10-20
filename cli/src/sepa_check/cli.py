"""Argument parsing and process exit codes for sepa-check."""

from __future__ import annotations

import sys
from pathlib import Path

from sepa_check.client import (
    ClientError,
    camt_convert_path,
    camt_validate_path,
    dumps,
    format_report,
    validate_path,
)

USAGE = """\
usage: sepa-check FILE [--json]
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
"""


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    if argv and argv[0] == "camt":
        return camt_main(argv[1:])
    return validate_main(argv)


def camt_main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        sys.stdout.write(USAGE)
        return 0 if argv and argv[0] in ("-h", "--help") else 2
    command = argv[0]
    if command not in ("validate", "convert"):
        sys.stderr.write(f"unknown camt command: {command}\n{USAGE}")
        return 2
    as_json = False
    output_format = "json"
    files: list[str] = []
    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg in ("-h", "--help"):
            sys.stdout.write(USAGE)
            return 0
        if arg == "--json":
            as_json = True
            i += 1
            continue
        if arg == "--format":
            if i + 1 >= len(argv):
                sys.stderr.write(f"--format needs json or csv\n{USAGE}")
                return 2
            output_format = argv[i + 1]
            i += 2
            continue
        if arg.startswith("--format="):
            output_format = arg.split("=", 1)[1]
            i += 1
            continue
        if arg.startswith("-"):
            sys.stderr.write(f"unknown option: {arg}\n{USAGE}")
            return 2
        files.append(arg)
        i += 1
    if len(files) != 1:
        sys.stderr.write(USAGE)
        return 2
    if command == "convert" and output_format not in ("json", "csv"):
        sys.stderr.write(f"format must be json or csv\n{USAGE}")
        return 2
    path = Path(files[0])
    try:
        if command == "validate":
            result = camt_validate_path(path)
        else:
            sys.stdout.write(camt_convert_path(path, output_format))
            return 0
    except ClientError as exc:
        if as_json:
            sys.stdout.write(dumps({"valid": False, "error": str(exc)}))
        else:
            sys.stderr.write(f"{exc}\n")
        return 2
    sys.stdout.write(dumps(result) if as_json else format_report(result, path.name))
    return 0 if result["valid"] else 1


def validate_main(argv: list[str]) -> int:
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
