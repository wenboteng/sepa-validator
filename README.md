# SEPA pain.001 validator — free API, CLI, and MCP server

Client tools for the free, keyless validator at [checksepa.com](https://checksepa.com). Send one SEPA credit-transfer XML file (ISO 20022 pain.001.001.03 or pain.001.001.09) and get structure and EPC findings back.

This repository is only the public client: CLI, MCP server, OpenAPI copy, samples, and examples. It does not contain the validator engine.

The file is uploaded to `POST https://checksepa.com/v1/validate` for that request. The service does not store it.

## Free limits

| Limit | Value |
| --- | --- |
| API key | none |
| Per IP per hour | 30 validations |
| Per IP per UTC day | 200 validations |
| Max upload | 2 MB |
| Over the hourly or daily limit | HTTP 429 and `Retry-After` |
| Over 2 MB | HTTP 413 |

Higher limits and API keys: [waitlist](https://checksepa.com/api-waitlist) (joining is free; planned from EUR 79/month, charged only after confirmation). Docs: [https://checksepa.com/docs](https://checksepa.com/docs). Machine-readable contract: [openapi.json](https://checksepa.com/openapi.json) (copy in [`openapi/openapi.json`](openapi/openapi.json)).

A file can pass here and still be rejected by a bank. Bank implementation guidelines are out of scope. This is not a bank login, EBICS client, Verification of Payee check, or payment initiation.

pain.008 and camt messages are recognised (`format` and `version`) and returned with `valid: false`. They are not rule-checked yet.

## curl

Using the published valid sample:

```bash
curl -F "file=@samples/valid-pain001-001-03.xml" https://checksepa.com/v1/validate
```

Raw XML body:

```bash
curl -X POST https://checksepa.com/v1/validate \
  -H "Content-Type: application/xml" \
  --data-binary @samples/valid-pain001-001-09.xml
```

[`examples/curl.sh`](examples/curl.sh) wraps the multipart request.

## Sample request and response

```bash
curl -F "file=@samples/invalid-pain001-001-03.xml" https://checksepa.com/v1/validate
```

The invalid sample is published as failing. The report has seven errors. The first one:

```json
{
  "valid": false,
  "format": "pain.001",
  "version": "pain.001.001.03",
  "errors": [
    {
      "code": "EPC-CTRLSUM",
      "message": "CtrlSum is 999.00 but the transactions sum to 175.50.",
      "path": "/Document/CstmrCdtTrfInitn/GrpHdr/CtrlSum",
      "line": 8
    }
  ],
  "warnings": []
}
```

`valid: true` means the file passed the free baseline. `errors` and `warnings` use `code`, `message`, `path`, and `line`. `line` is 1-based, or null when the parser cannot place the finding.

## Samples

Copied from the checksepa.com sample set. Synthetic data and dummy IBANs, not real payments.

| File | What to expect |
| --- | --- |
| [`samples/valid-pain001-001-03.xml`](samples/valid-pain001-001-03.xml) | Valid pain.001.001.03. Pass, no errors. |
| [`samples/valid-pain001-001-09.xml`](samples/valid-pain001-001-09.xml) | Valid pain.001.001.09. Pass, no errors. |
| [`samples/invalid-pain001-001-03.xml`](samples/invalid-pain001-001-03.xml) | Fail. Includes EPC-CTRLSUM, EPC-IBAN, EPC-NBOFTXS, EPC-CHRGBR, and XSD-REQUIRED. |

## CLI

Python 3.9+, package `sepa-check`. The only dependency is `requests`.

```bash
pip install ./cli
sepa-check samples/valid-pain001-001-03.xml
sepa-check samples/invalid-pain001-001-03.xml --json
```

Node 18+, package `sepa-check`, no dependencies:

```bash
npx ./cli-node samples/valid-pain001-001-03.xml
node cli-node/bin/sepa-check.js samples/invalid-pain001-001-03.xml --json
```

Human output prints each finding with its code, path, and line. `--json` prints the report. Exit `0` when `valid` is true, `1` when the file fails, `2` on usage, file, or HTTP errors (including 413 and 429).

After publish, the same commands are `pip install sepa-check` and `npx sepa-check file.xml`. They are not on PyPI or npm yet. Names checked on 19 October 2026: `sepa-check` was unused on both registries, and `sepa-validator-mcp` was unused on npm. See [Publishing](#publishing).

## MCP server

[`mcp/`](mcp/) is a stdio MCP server, package `sepa-validator-mcp`. It exposes one tool, `validate_sepa`, with `file_path` or `xml`. The result is `valid`, `format`, `version`, `errors[]`, and `warnings[]`.

Registry metadata is in [`mcp/server.json`](mcp/server.json) (`io.github.wenboteng/sepa-validator`). Config snippets for Claude Desktop, Cursor, and VS Code are in [`mcp/README.md`](mcp/README.md). Not submitted to the MCP registry yet.

## Examples

Short snippets that post the `file` field. Each run spends one free validation.

| Language | File |
| --- | --- |
| curl | [`examples/curl.sh`](examples/curl.sh) |
| Python (`requests`) | [`examples/python_requests.py`](examples/python_requests.py) |
| Node (`fetch`) | [`examples/node_fetch.mjs`](examples/node_fetch.mjs) |
| PHP | [`examples/validate.php`](examples/validate.php) |
| C# | [`examples/Program.cs`](examples/Program.cs) |
| Java | [`examples/Validate.java`](examples/Validate.java) |

## Links

- Docs: [https://checksepa.com/docs](https://checksepa.com/docs)
- OpenAPI: [https://checksepa.com/openapi.json](https://checksepa.com/openapi.json)
- API waitlist: [https://checksepa.com/api-waitlist](https://checksepa.com/api-waitlist)
- Samples on the site: [https://checksepa.com/samples](https://checksepa.com/samples)

## Deutsch

Kostenlose Client-Werkzeuge für die Prüfung von SEPA-Überweisungen (ISO 20022 pain.001.001.03 und pain.001.001.09) auf [checksepa.com](https://checksepa.com). Kein API-Schlüssel. Dieses Repository enthält nur Clients, Beispiele und die öffentliche OpenAPI-Datei, nicht die Validator-Engine.

Die Datei geht an `POST https://checksepa.com/v1/validate` und wird für diese eine Anfrage geprüft. Sie wird nicht gespeichert.

Grenzen: 30 Prüfungen pro IP und Stunde, 200 pro IP und UTC-Tag, maximal 2 MB. Darüber HTTP 429 mit `Retry-After`, bei mehr als 2 MB HTTP 413. Höhere Limits und API-Schlüssel über die [Warteliste](https://checksepa.com/api-waitlist) (ab 79 €/Monat geplant, Zahlung erst nach Bestätigung).

```bash
curl -F "file=@samples/valid-pain001-001-03.xml" https://checksepa.com/v1/validate
```

Die Beispieldateien unter [`samples/`](samples/) sind synthetisch, mit Dummy-IBANs: gültige pain.001.001.03, gültige pain.001.001.09, und eine ungültige pain.001.001.03 (unter anderem EPC-CTRLSUM und EPC-IBAN).

Antwortfelder: `valid`, `format` (zum Beispiel `pain.001`), `version` (zum Beispiel `pain.001.001.03`), `errors[]` und `warnings[]`. Jeder Fund hat `code`, `message`, `path` und `line`.

CLI: `sepa-check datei.xml` (Python) oder `npx sepa-check datei.xml` (Node, nach Veröffentlichung). Exit-Code 0 bei gültig, 1 bei ungültig, 2 bei Aufruf- oder HTTP-Fehler. `--json` gibt den Bericht aus.

pain.008 und camt werden erkannt und mit `valid: false` zurückgegeben. Sie werden noch nicht regelgeprüft. Eine bestandene Datei kann von der Bank trotzdem abgelehnt werden (bankeigene MIG). Kein Bank-Login, kein EBICS, keine Zahlungsauslösung.

Links: [API-Doku](https://checksepa.com/docs), [OpenAPI](https://checksepa.com/openapi.json), [Warteliste](https://checksepa.com/api-waitlist).

## Development

GitHub Actions lints the Python and Node clients, typechecks the MCP server, boots it over stdio, and runs live checks of the published samples. Those live checks skip when `checksepa.com:443` cannot be reached.

```bash
python -m pip install ./cli
python -m unittest discover -s tests -p 'test_*.py' -v
node --test cli-node/test/*.test.js
cd mcp && npm ci && npm run build && node --test test/*.test.js && node scripts/stdio-smoke.mjs
```

`node mcp/scripts/stdio-smoke.mjs samples/valid-pain001-001-03.xml` performs one extra live tool call. Do not loop it: the free quota is 30 per IP per hour.

## Publishing

Nothing in this repo is on npm, PyPI, or the MCP registry. Names checked on 19 October 2026 while preparing this tree: `sepa-check` (PyPI and npm) and `sepa-validator-mcp` (npm) were unused (registry 404). Do not publish from CI. Do not publish from this checkout unless you mean to.

PyPI, from a machine logged in via `~/.pypirc` or an API token:

```bash
cd cli
python -m pip install build twine
python -m build
python -m twine upload dist/*
```

npm CLI (unscoped package, public by default):

```bash
cd cli-node
npm login
npm publish
```

npm MCP server. `npm publish` runs `prepack`, which compiles TypeScript. Publish this package before the registry entry, because the registry checks `mcpName` in the published `package.json`.

```bash
cd mcp
npm login
npm publish
```

MCP registry, only after that npm publish. Use the official `mcp-publisher` binary from [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry), not the unrelated npm package named `mcp-publisher`.

```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
sudo mv mcp-publisher /usr/local/bin/
cd mcp
mcp-publisher validate server.json
mcp-publisher login github
mcp-publisher publish
```

The metadata points at `https://github.com/wenboteng/sepa-validator`. That remote is not created by this tree.

## License

MIT. Copyright (c) 2026 Bobook Limited. See [LICENSE](LICENSE).

The API is operated by Bobook Limited. Contact published on the service: info@bobook.club.
