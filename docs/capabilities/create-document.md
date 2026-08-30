# Google Docs: Create a document — MCP tool

**Google Docs MCP tool:** Creates a new Google Doc — empty, or converted from Markdown in one call.

Technical name: `create_document`

## What task it solves

> I want to create a new Google Doc, optionally with initial content.

Creates a new Google Doc — empty, or converted from Markdown in one call.

## When to use it

Use this capability when a workflow needs a fresh document: meeting notes, a report scaffold, or a document generated from Markdown produced by an AI assistant. Without `markdown` the API creates an empty document; with `markdown` the content is converted to native Docs formatting at creation.

## What to provide

- `title` — **required**. The document title (also the Drive file name).
- `markdown` — optional. Initial content as Markdown; headings, bold/italic, links, lists, tables and code blocks become native Docs formatting.

## What it returns

The new document's identifiers: `documentId` (plus `title` and revision data from `documents.create`, or the Drive file resource `id`/`name`/`mimeType` for the Markdown path). Keep the id — every other tool needs it.

## What changes in Google Docs

A new document appears in the authorized user's My Drive root. Nothing existing is modified. Moving or sharing the file afterwards is not covered by this server.

## Example request

> Create a document called "Q3 Launch Plan" from this Markdown outline.

## Errors and limitations

The plain path accepts ONLY a title — content, styles and settings come afterwards through the editing tools. The Markdown path is a Drive conversion: unsupported Markdown constructs degrade to plain text, and very large Markdown may hit upload limits. Creation is not idempotent: retrying a successful call creates a second document.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Replace document with Markdown](./import-markdown.md) — `import_markdown`
- [Insert text](./insert-text.md) — `insert_text`
- [Get document structure](./get-document.md) — `get_document`

## Technical details

- **Impact:** changes data
- **Group:** Documents and Markdown
- **Description source:** `create_document` registration in `src/tools/documents.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
