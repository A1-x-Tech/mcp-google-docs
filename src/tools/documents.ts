import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient } from "../client.js";
import { TEXT_EXPORT_FORMATS } from "../client.js";
import type { ExportFormat } from "../types.js";
import { documentIdSchema, fail, ok, READ_ONLY, tabIdSchema, UPDATE, WRITE } from "./util.js";

export function registerDocumentTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "create_document",
    {
      title: "Create a document",
      annotations: WRITE,
      description:
        "Creates a new Google Doc and returns its documentId. Without markdown it calls documents.create, which accepts ONLY a title — add content afterwards with insert_text/import_markdown. With markdown, the document is created from that Markdown via Drive conversion (headings, bold/italic, links, lists, tables and code blocks become native Docs formatting) and the result carries id (the documentId), name and mimeType. The document lands in the authorized user's My Drive root; moving or sharing it needs the Drive UI or API, which this server does not cover.",
      inputSchema: {
        title: z.string().min(1).describe("The document title (the Drive file name)."),
        markdown: z
          .string()
          .optional()
          .describe("Initial content as Markdown; omitted = an empty document."),
      },
    },
    async ({ title, markdown }) => {
      try {
        if (markdown !== undefined) {
          return ok(await client.createDocumentFromMarkdown({ title, markdown }));
        }
        return ok(await client.createDocument(title));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_document",
    {
      title: "Get document structure",
      annotations: READ_ONLY,
      description:
        "Returns the raw Docs API document: title, documentId, revisionId, per-tab body with every structural element's startIndex/endIndex, textRun styles, tables, lists, inlineObjects (image ids for replace_image), headers/footers (their segment ids) and named styles. This is the exact index map that range tools consume, but it is VERBOSE — for reading content prefer read_document_text, which returns compact blocks with the same indexes. include_tabs_content=true (default) populates all tabs; suggestions_view_mode controls how unresolved suggestions render (default DEFAULT_FOR_CURRENT_ACCESS).",
      inputSchema: {
        document_id: documentIdSchema(),
        include_tabs_content: z
          .boolean()
          .optional()
          .describe("Populate every tab's content (default true). false = first-tab legacy shape."),
        suggestions_view_mode: z
          .enum([
            "DEFAULT_FOR_CURRENT_ACCESS",
            "SUGGESTIONS_INLINE",
            "PREVIEW_SUGGESTIONS_ACCEPTED",
            "PREVIEW_WITHOUT_SUGGESTIONS",
          ])
          .optional()
          .describe("How unresolved suggested edits render in the returned content."),
      },
    },
    async ({ document_id, include_tabs_content, suggestions_view_mode }) => {
      try {
        return ok(
          await client.getDocument({
            documentId: document_id,
            includeTabsContent: include_tabs_content ?? true,
            suggestionsViewMode: suggestions_view_mode,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "read_document_text",
    {
      title: "Read document as text",
      annotations: READ_ONLY,
      description:
        "Returns the document as compact readable blocks, per tab: each paragraph with its text, start/end indexes (UTF-16 code units — the coordinates insert_text/replace_range/delete_range/style tools take), named style (headings) and bullet flag; tables come as cells[row][column] plain text with the table's range. Inline images appear as [image:<objectId>] placeholders (the id feeds replace_image). tab_id limits the output to one tab. Call this before any range edit — every insert/delete shifts later indexes, so indexes from before a mutation are stale.",
      inputSchema: {
        document_id: documentIdSchema(),
        tab_id: tabIdSchema().optional(),
      },
    },
    async ({ document_id, tab_id }) => {
      try {
        return ok(await client.readDocumentText({ documentId: document_id, tabId: tab_id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_tabs",
    {
      title: "List document tabs",
      annotations: READ_ONLY,
      description:
        "Returns the document's tab tree without content: tabId, title, position index and nested childTabs. Use the tabId values to target a specific tab in read_document_text and every editing tool. NOTE: the Docs API cannot create, rename, delete or reorder tabs — that is UI-only; this tool only discovers what exists.",
      inputSchema: { document_id: documentIdSchema() },
    },
    async ({ document_id }) => {
      try {
        return ok(await client.listTabs(document_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "export_document",
    {
      title: "Export a document",
      // Not READ_ONLY: with output_path this tool creates a file on the local
      // machine, and readOnlyHint promises the environment stays untouched.
      annotations: WRITE,
      description:
        "Exports the document via Drive. Text formats (markdown, txt, html) are returned inline as the tool result — format=markdown is the way to read a doc as Markdown for a round trip with import_markdown. Binary formats (pdf, docx, odt, rtf, epub) require output_path and are written to that local file (the result reports saved_to and bytes); output_path also works for text formats. output_path must be absolute, and an existing file is never overwritten unless overwrite=true. Exports are capped at 10 MB by the Drive API; comments and suggestions are not part of any export. Nothing in Google Docs changes; the only side effect is the local file when output_path is set.",
      inputSchema: {
        document_id: documentIdSchema(),
        format: z
          .enum(["markdown", "txt", "html", "rtf", "pdf", "docx", "odt", "epub"])
          .describe("Target format; markdown/txt/html can be returned inline, the rest need output_path."),
        output_path: z
          .string()
          .optional()
          .describe(
            "Absolute local file path to write the export to (required for binary formats). Refused if the file already exists, unless overwrite=true.",
          ),
        overwrite: z
          .boolean()
          .optional()
          .describe("Allow output_path to replace an existing file (default false)."),
      },
    },
    async ({ document_id, format, output_path, overwrite }) => {
      try {
        if (output_path !== undefined && !isAbsolute(output_path)) {
          return fail(
            new Error(
              `output_path must be an absolute path (got "${output_path}") — the server's working directory is not the caller's.`,
            ),
          );
        }
        const bytes = await client.exportDocument({
          documentId: document_id,
          format: format as ExportFormat,
        });
        if (output_path) {
          try {
            // "wx" fails on an existing file instead of silently replacing it.
            await writeFile(output_path, bytes, { flag: overwrite ? "w" : "wx" });
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === "EEXIST") {
              return fail(
                new Error(
                  `output_path "${output_path}" already exists — pass overwrite=true to replace it.`,
                ),
              );
            }
            throw e;
          }
          return ok({ saved_to: output_path, format, bytes: bytes.byteLength });
        }
        if (!TEXT_EXPORT_FORMATS.has(format as ExportFormat)) {
          return fail(
            new Error(`format "${format}" is binary — provide output_path to save it to a file.`),
          );
        }
        return ok(new TextDecoder().decode(bytes));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "import_markdown",
    {
      title: "Replace document with Markdown",
      annotations: UPDATE,
      description:
        "REPLACES the ENTIRE document content with the given Markdown via Drive conversion — the Markdown round-trip writer paired with export_document format=markdown. Supported Markdown (headings, bold/italic/strikethrough, links, ordered/unordered lists, tables, code blocks, images by URL) becomes native Docs formatting. Everything not expressed in the Markdown is LOST: existing text, comment anchors (comments survive but detach), positioned objects, headers/footers and extra tabs. For surgical edits use replace_range/style tools instead. Returns the Drive file resource (id, name, modifiedTime).",
      inputSchema: {
        document_id: documentIdSchema(),
        markdown: z.string().min(1).describe("The full new document content as Markdown."),
      },
    },
    async ({ document_id, markdown }) => {
      try {
        return ok(await client.importMarkdown({ documentId: document_id, markdown }));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
