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
  UPDATE,
  WRITE,
} from "./util.js";

export function registerTextTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "insert_text",
    {
      title: "Insert text",
      annotations: WRITE,
      description:
        "Inserts plain text at an index (UTF-16 code units; body content starts at index 1 — get indexes from read_document_text). Omit index to append at the end of the body (or of the segment when segment_id is set). Newlines in the text create new paragraphs; the text inherits the style at the insertion point — style it afterwards with style_text/style_paragraph. Every insert shifts all later indexes, so when making several edits, apply them from the END of the document backwards or re-read between edits. Returns the batchUpdate reply with the new revisionId.",
      inputSchema: {
        document_id: documentIdSchema(),
        text: z.string().min(1).describe("The text to insert; \\n starts a new paragraph."),
        index: indexSchema()
          .optional()
          .describe("Insertion index (from read_document_text). Omit to append at the end."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async ({ document_id, text, index, tab_id, segment_id }) => {
      try {
        return ok(
          await client.insertText({
            documentId: document_id,
            text,
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
    "replace_range",
    {
      title: "Replace a text range",
      annotations: DESTRUCTIVE,
      description:
        "Replaces the content in [start_index, end_index) with new text — one atomic batchUpdate that deletes the range and inserts at its start, so nothing is lost if either step would fail. Get fresh indexes from read_document_text first: indexes are stale after ANY previous edit. The new text takes the style at start_index. Cannot cut across a table cell boundary or delete a paragraph's final newline together with only part of the next paragraph — the API rejects such ranges. An empty replacement is allowed and equals delete_range.",
      inputSchema: {
        document_id: documentIdSchema(),
        start_index: indexSchema().describe("Start of the range to replace (inclusive)."),
        end_index: indexSchema().describe("End of the range to replace (exclusive)."),
        text: z.string().describe("The replacement text; empty string just deletes the range."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async ({ document_id, start_index, end_index, text, tab_id, segment_id }) => {
      try {
        if (end_index <= start_index) {
          return fail(new Error("end_index must be greater than start_index."));
        }
        return ok(
          await client.replaceRange({
            documentId: document_id,
            startIndex: start_index,
            endIndex: end_index,
            text,
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
    "replace_all_text",
    {
      title: "Find and replace text",
      annotations: UPDATE,
      description:
        "Replaces EVERY occurrence of a literal string (no regex) across the whole document, or only in the tabs named by tab_ids. match_case defaults to true. Returns occurrencesChanged in the batchUpdate reply — 0 means the text was not found, not an error. Safer than replace_range for textual substitutions because it does not depend on indexes; use replace_range when position matters (e.g. only one of several occurrences).",
      inputSchema: {
        document_id: documentIdSchema(),
        find: z.string().min(1).describe("The literal text to find (no regex)."),
        replace: z.string().describe("The replacement text; empty string deletes the occurrences."),
        match_case: z.boolean().optional().describe("Case-sensitive matching (default true)."),
        tab_ids: z
          .array(z.string().min(1))
          .optional()
          .describe("Limit the replacement to these tabs (from list_tabs); omit for all tabs."),
      },
    },
    async ({ document_id, find, replace, match_case, tab_ids }) => {
      try {
        return ok(
          await client.replaceAllText({
            documentId: document_id,
            find,
            replace,
            matchCase: match_case,
            tabIds: tab_ids,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_range",
    {
      title: "Delete a text range",
      annotations: DESTRUCTIVE,
      description:
        "Deletes the content in [start_index, end_index) — text, inline images, whole tables or any mix, as long as the range does not cut across a table cell boundary. Get fresh indexes from read_document_text first; every delete shifts all later indexes down. Deleting a paragraph's trailing newline merges it with the next paragraph. The tab's final newline cannot be deleted. This is final — there is no undo through the API.",
      inputSchema: {
        document_id: documentIdSchema(),
        start_index: indexSchema().describe("Start of the range to delete (inclusive)."),
        end_index: indexSchema().describe("End of the range to delete (exclusive)."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async ({ document_id, start_index, end_index, tab_id, segment_id }) => {
      try {
        if (end_index <= start_index) {
          return fail(new Error("end_index must be greater than start_index."));
        }
        return ok(
          await client.deleteRange({
            documentId: document_id,
            startIndex: start_index,
            endIndex: end_index,
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
