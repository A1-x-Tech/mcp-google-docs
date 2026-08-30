# Google Docs: Export a document — MCP tool

**Google Docs MCP tool:** Exports the document as Markdown, text, HTML or a binary file format.

Technical name: `export_document`

## What task it solves

> I want to export a document as Markdown, PDF or another format.

Exports the document as Markdown, text, HTML or a binary file format.

## When to use it

Use it to read a document as Markdown (the reading half of the Markdown round trip), to hand the content to another system, or to save a PDF/DOCX/ODT/RTF/EPUB copy locally.

## What to provide

- `document_id` — **required**.
- `format` — **required**. One of `markdown`, `txt`, `html`, `rtf`, `pdf`, `docx`, `odt`, `epub`.
- `output_path` — optional for text formats, **required for binary formats**. Absolute local file path to write to; relative paths are refused.
- `overwrite` — optional (default `false`). Must be `true` for `output_path` to replace a file that already exists.

## What it returns

Text formats (`markdown`, `txt`, `html`) inline as the tool result; with `output_path` (and for all binary formats) the file is written locally and the result reports `saved_to` and `bytes`.

## What changes in Google Docs

Nothing in Google Docs. With `output_path` a **new file is created on the local machine** running the server — which is why the tool is not annotated read-only. An existing file at that path is never touched unless `overwrite=true`.

## Example request

> Export the launch plan as Markdown so we can review it as text.

## Errors and limitations

Drive caps exports at 10 MB. Comments and unresolved suggestions are not part of any export. Binary formats without `output_path` are refused, as are relative `output_path` values and paths pointing at an existing file when `overwrite` is not `true`.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Replace document with Markdown](./import-markdown.md) — `import_markdown`
- [Read document as text](./read-document-text.md) — `read_document_text`

## Technical details

- **Impact:** changes data (nothing in Google Docs — with `output_path` it creates a file on the local machine)
- **Group:** Documents and Markdown
- **Description source:** `export_document` registration in `src/tools/documents.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
