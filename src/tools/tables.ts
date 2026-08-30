import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient } from "../client.js";
import {
  DESTRUCTIVE,
  documentIdSchema,
  fail,
  indexSchema,
  ok,
  segmentIdSchema,
  tabIdSchema,
  WRITE,
} from "./util.js";

export function registerTableTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "insert_table",
    {
      title: "Insert a table",
      annotations: WRITE,
      description:
        "Inserts an empty rows x columns table at an index, or at the end of the body when index is omitted. Fill the cells afterwards: read_document_text shows the new table's range and per-cell layout, then insert_text into each cell (cell content ranges are visible in get_document; each cell holds its own paragraphs). Cell merging, cell background/borders and pinned header rows are not covered by typed tools — use raw_request with mergeTableCells/updateTableCellStyle/pinTableHeaderRows.",
      inputSchema: {
        document_id: documentIdSchema(),
        rows: z.number().int().min(1).max(1000).describe("Number of rows."),
        columns: z.number().int().min(1).max(20).describe("Number of columns (the API caps width)."),
        index: indexSchema()
          .optional()
          .describe("Insertion index (from read_document_text). Omit to append at the end."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async ({ document_id, rows, columns, index, tab_id, segment_id }) => {
      try {
        return ok(
          await client.insertTable({
            documentId: document_id,
            rows,
            columns,
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

  server.registerTool(
    "edit_table",
    {
      title: "Edit table rows and columns",
      annotations: DESTRUCTIVE,
      description:
        "Inserts or deletes a row/column of an existing table. The table is addressed by table_start_index — the table block's start index from read_document_text (its startIndex in get_document). action=insert_row adds next to the cell at row_index/column_index (insert_below, default true); insert_column likewise (insert_right, default true); delete_row / delete_column remove the row/column containing that cell WITH ALL ITS CONTENT — that content is unrecoverable. row_index/column_index are 0-based and default to 0. Deleting shifts every later index in the document; re-read before further edits.",
      inputSchema: {
        document_id: documentIdSchema(),
        action: z
          .enum(["insert_row", "insert_column", "delete_row", "delete_column"])
          .describe("What to do with the table."),
        table_start_index: indexSchema().describe(
          "The table's start index (the table block's start in read_document_text).",
        ),
        row_index: z.number().int().min(0).optional().describe("0-based row of the anchor cell (default 0)."),
        column_index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("0-based column of the anchor cell (default 0)."),
        insert_below: z
          .boolean()
          .optional()
          .describe("insert_row only: insert below the anchor row (default true; false = above)."),
        insert_right: z
          .boolean()
          .optional()
          .describe("insert_column only: insert right of the anchor column (default true; false = left)."),
        tab_id: tabIdSchema().optional(),
      },
    },
    async ({ document_id, action, table_start_index, row_index, column_index, insert_below, insert_right, tab_id }) => {
      try {
        return ok(
          await client.editTable({
            documentId: document_id,
            action,
            tableStartIndex: table_start_index,
            rowIndex: row_index,
            columnIndex: column_index,
            insertBelow: insert_below,
            insertRight: insert_right,
            tabId: tab_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
