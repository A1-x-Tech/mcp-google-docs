# Google Docs: Get document structure — MCP tool

**Google Docs MCP tool:** Returns the raw Docs API document with every structural element and index.

Technical name: `get_document`

## What task it solves

> I want to inspect the full technical structure of a document.

Returns the raw Docs API document with every structural element and index.

## When to use it

Use it when the compact view from `read_document_text` is not enough: you need text run styles, `inlineObjects` image ids, header/footer segment ids, list definitions, suggestions, or the exact JSON the Docs API stores. For plain reading prefer `read_document_text` — this output is verbose.

## What to provide

- `document_id` — **required**. The id from the document URL or `create_document`.
- `include_tabs_content` — optional, default true. Populate every tab's content.
- `suggestions_view_mode` — optional. How unresolved suggested edits render.

## What it returns

The raw Docs API document: `title`, `documentId`, `revisionId`, per-tab `body.content` with `startIndex`/`endIndex` on every element, `inlineObjects`, headers/footers and named styles.

## What changes in Google Docs

Nothing — the tool reads Google Docs data and does not change it.

## Example request

> Show me the raw structure of this document so we can find the image object ids.

## Errors and limitations

Large documents produce very large responses — use `read_document_text` for content work. Indexes are UTF-16 code units and go stale after any edit.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Read document as text](./read-document-text.md) — `read_document_text`
- [List document tabs](./list-tabs.md) — `list_tabs`
- [Raw Google Docs API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** read-only
- **Group:** Documents and Markdown
- **Description source:** `get_document` registration in `src/tools/documents.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
