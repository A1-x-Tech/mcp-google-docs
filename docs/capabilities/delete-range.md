# Google Docs: Delete a text range — MCP tool

**Google Docs MCP tool:** Deletes the content between two indexes — text, images or whole tables.

Technical name: `delete_range`

## What task it solves

> I want to delete part of a document.

Deletes the content between two indexes — text, images or whole tables.

## When to use it

Use it to remove a passage, an inline image (delete its one-index range) or a whole table. Take fresh indexes from `read_document_text` immediately before the call.

## What to provide

- `document_id` — **required**.
- `start_index` / `end_index` — **required**. The range [start, end) to delete.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

The range content is permanently removed; every later index shifts down. Deleting a paragraph's trailing newline merges it with the next paragraph.

## Example request

> Delete the outdated pricing table from the proposal.

## Errors and limitations

Final — no undo through the API. The range must not cut across a table cell boundary, and the tab's final newline cannot be deleted. Never retried automatically after an ambiguous failure.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Replace a text range](./replace-range.md) — `replace_range`
- [Read document as text](./read-document-text.md) — `read_document_text`

## Technical details

- **Impact:** destructive operation
- **Group:** Text editing
- **Description source:** `delete_range` registration in `src/tools/text.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
