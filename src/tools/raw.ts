import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient, HttpMethod } from "../client.js";
import { DESTRUCTIVE, fail, ok } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Google Docs API call",
      // Full API surface incl. batchUpdate with any request type — annotate for
      // the worst case a call can do, not the average.
      annotations: DESTRUCTIVE,
      description:
        'Escape hatch to call any Google Docs API v1 path directly, for requests the typed tools don\'t cover — e.g. a batchUpdate with mergeTableCells, updateTableCellStyle, pinTableHeaderRows, updateSectionStyle, updateDocumentStyle, createHeader/createFooter, createFootnote, named ranges, or several requests at once with writeControl.requiredRevisionId: path "v1/documents/<documentId>:batchUpdate", method POST, body {"requests":[...]}. The path may carry a query string. The Bearer token is added automatically; the method defaults to GET. Only docs.googleapis.com paths are reachable — Drive endpoints are not exposed here.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe('API path relative to https://docs.googleapis.com, e.g. "v1/documents/<documentId>:batchUpdate".'),
        method: z
          .enum(["GET", "POST"])
          .optional()
          .describe("HTTP method (the Docs API uses only these two). Defaults to GET."),
        body: z.record(z.any()).optional().describe("JSON request body (POST only)."),
      },
    },
    async ({ path, method, body }) => {
      try {
        const m = (method ?? "GET") as HttpMethod;
        return ok(await client.request(m, path, body));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
