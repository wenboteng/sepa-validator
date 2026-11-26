# Install sepa-validator-mcp

No API key. The server calls the free checksepa.com API.

Free limits, shared by `validate_sepa`, `camt_validate`, and `camt_convert`: 30 requests per IP per hour, 200 per IP per UTC day, 2 MB maximum. Over the hourly or daily limit the API returns HTTP 429. Over the size limit it returns HTTP 413. The file is not stored.

```json
{
  "mcpServers": {
    "sepa-validator": {
      "command": "npx",
      "args": ["-y", "sepa-validator-mcp"]
    }
  }
}
```

Registry id: `io.github.wenboteng/sepa-validator`.

## What each tool returns

`validate_sepa` also checks pain.008.001.02 and .001.08, and pain.001.001.03 and pain.001.001.09. It returns `valid`, `format`, `version`, `errors[]`, and `warnings[]`. Each finding has `code`, `message`, `path`, and `line`.

`camt_validate` checks camt.053 and camt.054 versions .02 and .08. It returns the same report: `valid`, `format`, `version`, `errors[]`, and `warnings[]`.

`camt_convert` returns normalized JSON (`format`, `version`, `statements[]` with account IBAN, balances, and entries) or CSV (`csv`). Entry fields include amount, currency, credit or debit, booking date, value date, counterparty name, counterparty IBAN, remittance, and end-to-end id.
