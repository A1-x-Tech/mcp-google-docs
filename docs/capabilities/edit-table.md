# Google Docs: Edit table rows and columns — MCP tool

**Google Docs MCP tool:** Inserts or deletes a row or column of an existing table.

Technical name: `edit_table`

## What task it solves

> I want to add or remove table rows and columns.

Inserts or deletes a row or column of an existing table.

## When to use it

Use it to grow or shrink an existing table. The table is addressed by its start index (the table block's `start` in `read_document_text`); the anchor cell picks where to insert or what to delete.

## What to provide

- `document_id` — **required**.
- `action` — **required**: `insert_row`, `insert_column`, `delete_row`, `delete_column`.
- `table_start_index` — **required**. The table's start index.
- `row_index`, `column_index` — optional 0-based anchor cell (default 0,0).
- `insert_below` / `insert_right` — optional direction for inserts (default true).
- `tab_id` — optional.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

A row/column is added empty, or removed WITH ALL ITS CONTENT. Every later index in the document shifts.

## Example request

> Delete the last column of the pricing table.

## Errors and limitations

Deleted cell content is unrecoverable. Merging/unmerging cells and cell styling are not covered — use raw_request. Re-read indexes before further edits.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert a table](./insert-table.md) — `insert_table`
- [Read document as text](./read-document-text.md) — `read_document_text`
- [Raw Google Docs API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** destructive operation
- **Group:** Tables
- **Description source:** `edit_table` registration in `src/tools/tables.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
