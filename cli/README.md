# sepa-check

Command-line client for the free, keyless SEPA pain.001 validator API.

```bash
pip install sepa-check
sepa-check pain001.xml
sepa-check pain001.xml --json
sepa-check camt validate statement.xml --json
sepa-check camt convert statement.xml --format csv
```

Until the package is on PyPI, install it from a checkout:

```bash
pip install ./cli
```

`FILE` is a SEPA XML document. The command posts it as multipart field `file` to `https://checksepa.com/v1/validate`. `camt validate` posts to `https://checksepa.com/v1/camt/validate`. `camt convert` posts to `https://checksepa.com/v1/camt/convert`. Python 3.9+. The only dependency is `requests`. Version 0.2.1.

No API key. Free limit: 30 validations per IP per hour, 200 per UTC day, 2 MB maximum. HTTP 429 carries `Retry-After`. Higher limits and API keys: https://checksepa.com/api-waitlist

Human output lists each failing code, the element path, the line, the message, and a one-line English hint when one is known. `--json` prints `valid`, `format`, `version`, `errors`, and `warnings`, and each finding includes `hint`.

## What each error means

| Code | What to fix |
| --- | --- |
| `XSD` | The file does not match the official schema. Check the namespace (`camt.054.001.02` versus `.001.08`) and the element named in the message. |
| `XSD-REQUIRED` | A required element is missing. Add the child the message names. |
| `XSD-UNEXPECTED` | An element is not allowed there. Bank-specific extensions are outside this ISO schema. |
| `XSD-TYPE` | A value has the wrong type, length, or pattern (a common case is a bad IBAN). |
| `XSD-VERSION` | This message version is not checked. camt.053 and camt.054 use `.001.02` or `.001.08`. pain.008 is not supported. |
| `EPC-IBAN` | Use a compact IBAN with no spaces that passes the mod-97 check. |
| `EPC-CTRLSUM` | `CtrlSum` must equal the sum of the instructed amounts. |

camt schema notes and samples: https://checksepa.com/camt . pain.001 docs: https://checksepa.com/docs .

| Exit | Meaning |
| --- | --- |
| 0 | `valid` was true |
| 1 | the file is invalid |
| 2 | usage error, unreadable file, or the API could not be reached |

Docs: https://checksepa.com/docs · OpenAPI: https://checksepa.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
