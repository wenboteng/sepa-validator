# sepa-validator-mcp

Stdio MCP server, version 0.2.1. Tools: `validate_sepa` (`POST https://checksepa.com/v1/validate`), `camt_validate` (`POST https://checksepa.com/v1/camt/validate`), and `camt_convert` (`POST https://checksepa.com/v1/camt/convert`, `format` `json` or `csv`).

Input: exactly one of `file_path` (read by this process) or `xml` (the document as a string).

Output: `valid`, `format`, `version`, `errors[]`, and `warnings[]`. Each finding has `code`, `message`, `path`, and `line` (`line` is an integer or null).

`validate_sepa` also checks pain.008.001.02 and .001.08. `camt_validate` and `camt_convert` cover camt.053 and camt.054 versions .02 and .08. The three routes share the free limit.

Free limit: 30 requests per IP per hour, 200 per UTC day, 2 MB. The file is not stored. The tool calls the network, so it is not a local read-only check. The server calls the keyless API. For more volume, get a free API key (500 calls per calendar month) at https://checksepa.com/docs#free-key and use it with the HTTP API in the `X-API-Key` header. API Pro (EUR 19/month, 5,000 calls) and API Business (EUR 79/month, 50,000 calls) upgrade that same key. On HTTP 429 the tools return the API Pro link.

Package name: `sepa-validator-mcp`. Registry name in [`server.json`](server.json): `io.github.wenboteng/sepa-validator` (`mcpName` matches). Install with `npx -y sepa-validator-mcp`. Build from a checkout with `npm run build` (`node dist/index.js`).

## Hosted MCP server (no install)

`https://checksepa.com/mcp` is a remote MCP server (Streamable HTTP) with the same tools: `validate_sepa`, `camt_validate` and `camt_convert` (`xml`, plus `format` json or csv for convert). Files are sent inline, nothing is stored. Without a key the free limit is 30 calls per IP per hour and 200 per UTC day; send a [free API key](https://checksepa.com/docs#free-key) as `X-API-Key` or `Authorization: Bearer` for 500 a month. Claude Code: `claude mcp add --transport http sepa https://checksepa.com/mcp`. Generic config: `{"mcpServers": {"sepa": {"type": "http", "url": "https://checksepa.com/mcp"}}}`.

## Claude Desktop

`claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

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

## Cursor

`~/.cursor/mcp.json` or the project file `.cursor/mcp.json`:

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

From a checkout, before the npm publish:

```json
{
  "mcpServers": {
    "sepa-validator": {
      "command": "node",
      "args": ["mcp/dist/index.js"]
    }
  }
}
```

## VS Code

`.vscode/mcp.json`:

```json
{
  "servers": {
    "sepa-validator": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "sepa-validator-mcp"]
    }
  }
}
```

Docs: https://checksepa.com/docs · OpenAPI: https://checksepa.com/openapi.json

MIT. Copyright (c) 2026 Bobook Limited.
