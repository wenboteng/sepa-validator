#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ApiError, validatePath, validateXml } from "./api.js";

const server = new McpServer({
  name: "sepa-validator",
  version: "0.1.0",
});

const findingSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string(),
  line: z.number().nullable(),
});

server.registerTool(
  "validate_sepa",
  {
    title: "Validate SEPA XML",
    description:
      "Validate one SEPA XML document (pain.001.001.03 or pain.001.001.09). " +
      "The file is uploaded to the free keyless API POST https://checksepa.com/v1/validate. " +
      "Limits: 30 requests per IP per hour, 200 per UTC day, 2 MB. " +
      "The file is not stored. Provide exactly one of file_path or xml. " +
      "Returns valid, format, version, errors, and warnings. Each finding has code, message, path, and line.",
    inputSchema: {
      file_path: z.string().optional().describe("Path to a SEPA XML file. Resolved by this process."),
      xml: z.string().optional().describe("SEPA XML as a string. Use this or file_path."),
    },
    outputSchema: {
      valid: z.boolean(),
      format: z.string().nullable(),
      version: z.string().nullable(),
      errors: z.array(findingSchema),
      warnings: z.array(findingSchema),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async ({ file_path, xml }) => {
    const path = file_path?.trim() ?? "";
    const document = xml?.trim() ?? "";
    if (Boolean(path) === Boolean(document)) {
      return toolError("Provide exactly one of file_path or xml.");
    }
    try {
      const result = path ? await validatePath(path) : await validateXml(document);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as { [key: string]: unknown },
      };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      return toolError(message);
    }
  },
);

function toolError(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`sepa-validator-mcp: ${message}\n`);
  process.exit(1);
});
