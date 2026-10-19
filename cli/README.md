# sepa-check

Command-line client for the free, keyless SEPA pain.001 validator API.

```bash
pip install sepa-check
sepa-check pain001.xml
sepa-check pain001.xml --json
```

Until the package is on PyPI, install it from a checkout:

```bash
pip install ./cli
```

`FILE` is a SEPA XML document. The command posts it as multipart field `file` to `https://checksepa.com/v1/validate`. Python 3.9+. The only dependency is `requests`.

No API key. Free limit: 30 validations per IP per hour, 200 per UTC day, 2 MB maximum. HTTP 429 carries `Retry-After`. Higher limits and API keys: https://checksepa.com/api-waitlist

Human output lists each finding with its code, path, and line. `--json` prints `valid`, `format`, `version`, `errors`, and `warnings`.

| Exit | Meaning |
| --- | --- |
| 0 | `valid` was true |
| 1 | the file is invalid |
| 2 | usage error, unreadable file, or the API could not be reached |

Docs: https://checksepa.com/docs · OpenAPI: https://checksepa.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
