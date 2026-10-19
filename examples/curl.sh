#!/usr/bin/env bash
# Upload one SEPA XML file. This calls the live API and uses one free validation.
#
#   ./examples/curl.sh samples/valid-pain001-001-03.xml
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo "usage: curl.sh FILE" >&2
  echo "curl -F file=@samples/valid-pain001-001-03.xml https://checksepa.com/v1/validate" >&2
  exit 2
fi
curl -sS -F "file=@$1" "https://checksepa.com/v1/validate"
echo
