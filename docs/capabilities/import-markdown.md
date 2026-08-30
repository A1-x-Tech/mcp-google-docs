# Google Docs: Replace document with Markdown — MCP tool

**Google Docs MCP tool:** Replaces the entire document body with new Markdown via Drive conversion.

Technical name: `import_markdown`

## What task it solves

> I want to rewrite a whole document from Markdown.

Replaces the entire document body with new Markdown via Drive conversion.

## When to use it

The writing half of the Markdown round trip: export with `export_document format=markdown`, edit the Markdown, then write it back here. Use it for wholesale rewrites; for surgical edits use `replace_range` and the style tools instead.

## What to provide

- `document_id` — **required**.
- `markdown` — **required**. The full new document content.

## What it returns

The Drive file resource (`id`, `name`, `mimeType`, `modifiedTime`).

## What changes in Google Docs

The ENTIRE document body is replaced. Supported Markdown becomes native Docs formatting. Existing text, comment anchors (comments survive but detach), positioned objects, headers/footers and extra tabs are lost.

## Example request

> Replace the whole draft with this corrected Markdown version.

## Errors and limitations

This is destructive and final — there is no undo through the API. Formatting the Drive Markdown dialect does not support (e.g. footnotes) will not survive the round trip. Never retried automatically after an ambiguous failure; check the document state before re-sending.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Export a document](./export-document.md) — `export_document`
- [Replace a text range](./replace-range.md) — `replace_range`
- [Create a document](./create-document.md) — `create_document`

## Technical details

- **Impact:** destructive operation
- **Group:** Documents and Markdown
- **Description source:** `import_markdown` registration in `src/tools/documents.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
