# sepa-validator-mcp

Stdio MCP server, version 0.2.0. Tools: `validate_sepa` (`POST https://checksepa.com/v1/validate`), `camt_validate` (`POST https://checksepa.com/v1/camt/validate`), and `camt_convert` (`POST https://checksepa.com/v1/camt/convert`, `format` `json` or `csv`).

Input: exactly one of `file_path` (read by this process) or `xml` (the document as a string).

Output: `valid`, `format`, `version`, `errors[]`, and `warnings[]`. Each finding has `code`, `message`, `path`, and `line` (`line` is an integer or null).

`validate_sepa` covers pain.001.001.03 and pain.001.001.09. `camt_validate` and `camt_convert` cover camt.053 and camt.054 versions .02 and .08. pain.008 is recognised by `validate_sepa` and returned with `valid: false`. The three routes share the free limit.

Free limit: 30 requests per IP per hour, 200 per UTC day, 2 MB. The file is not stored. The tool calls the network, so it is not a local read-only check. Higher limits and API keys: https://checksepa.com/api-waitlist

Package name: `sepa-validator-mcp`. Registry name in [`server.json`](server.json): `io.github.wenboteng/sepa-validator` (`mcpName` matches). Not submitted to the MCP registry yet. Build with `npm run build` (`node dist/index.js`) or, after publish, `npx -y sepa-validator-mcp`.

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
