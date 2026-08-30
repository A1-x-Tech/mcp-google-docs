# Google Docs: Read document as text — MCP tool

**Google Docs MCP tool:** Returns the document as compact readable blocks with edit-ready indexes.

Technical name: `read_document_text`

## What task it solves

> I want to read a document's content as plain text.

Returns the document as compact readable blocks with edit-ready indexes.

## When to use it

The default reading tool: use it before summarizing, quoting or editing a document. Every paragraph comes with its `start`/`end` indexes — exactly the coordinates that `insert_text`, `replace_range`, `delete_range` and the style tools take — plus heading styles, bullet flags and table cell text.

## What to provide

- `document_id` — **required**.
- `tab_id` — optional. Limit the output to one tab (ids from `list_tabs`).

## What it returns

Per tab: an array of blocks — paragraphs (`text`, `start`, `end`, heading `style`, `bullet`) and tables (`rows`, `columns`, `cells[row][column]` plain text). Inline images appear as `[image:<objectId>]` placeholders.

## What changes in Google Docs

Nothing — the tool reads Google Docs data and does not change it.

## Example request

> Read the launch plan document and summarize the open questions section.

## Errors and limitations

Indexes go stale after ANY edit — re-read between mutations. Footnotes, headers and footers are not part of the body blocks; fetch them via get_document.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get document structure](./get-document.md) — `get_document`
- [Export a document](./export-document.md) — `export_document`
- [Replace a text range](./replace-range.md) — `replace_range`

## Technical details

- **Impact:** read-only
- **Group:** Documents and Markdown
- **Description source:** `read_document_text` registration in `src/tools/documents.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
