# Google Docs: Insert a table — MCP tool

**Google Docs MCP tool:** Inserts an empty rows x columns table at an index or the end of the body.

Technical name: `insert_table`

## What task it solves

> I want to add a table to a document.

Inserts an empty rows x columns table at an index or the end of the body.

## When to use it

Use it to create the table shell; then re-read the document and fill each cell with `insert_text`. Merging cells, cell backgrounds and pinned header rows go through `raw_request`.

## What to provide

- `document_id` — **required**.
- `rows`, `columns` — **required**.
- `index` — optional insertion point; omit to append at the end.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

An empty table appears at the position; every later index shifts. The table's own range and per-cell layout are visible via read_document_text / get_document afterwards.

## Example request

> Insert a 3x4 table after the introduction for the comparison matrix.

## Errors and limitations

Cells must be filled cell-by-cell afterwards — there is no bulk cell-fill request. Alternatively, create tables with content in one step via create_document/import_markdown from Markdown.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Edit table rows and columns](./edit-table.md) — `edit_table`
- [Insert text](./insert-text.md) — `insert_text`
- [Raw Google Docs API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** changes data
- **Group:** Tables
- **Description source:** `insert_table` registration in `src/tools/tables.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
