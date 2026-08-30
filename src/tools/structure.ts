import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient } from "../client.js";
import { documentIdSchema, fail, indexSchema, ok, segmentIdSchema, tabIdSchema, WRITE } from "./util.js";

export function registerStructureTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "insert_break",
    {
      title: "Insert a page or section break",
      annotations: WRITE,
      description:
        "Inserts a break at an index (or at the end of the body when index is omitted). kind=page starts a new page; kind=section_next_page starts a new section on a new page; kind=section_continuous starts a new section on the same page. Sections carry their own margins/columns — style them via raw_request updateSectionStyle. Breaks cannot be inserted into headers, footers, footnotes or table cells. A break occupies one index position; remove one by deleting its range with delete_range.",
      inputSchema: {
        document_id: documentIdSchema(),
        kind: z
          .enum(["page", "section_next_page", "section_continuous"])
          .describe("The break type."),
        index: indexSchema()
          .optional()
          .describe("Insertion index (from read_document_text). Omit to append at the end of the body."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async ({ document_id, kind, index, tab_id, segment_id }) => {
      try {
        return ok(
          await client.insertBreak({
            documentId: document_id,
            kind,
            index,
            tabId: tab_id,
            segmentId: segment_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
