# Google Docs: Replace a text range — MCP tool

**Google Docs MCP tool:** Replaces one exact index range with new text in a single atomic batchUpdate.

Technical name: `replace_range`

## What task it solves

> I want to rewrite a specific passage of a document.

Replaces one exact index range with new text in a single atomic batchUpdate.

## When to use it

Use it when position matters — rewriting one sentence, one heading or one occurrence among many. For textual find-and-replace across the document use `replace_all_text`; for a full rewrite use `import_markdown`.

## What to provide

- `document_id` — **required**.
- `start_index` / `end_index` — **required**. The range [start, end) from `read_document_text`, fetched AFTER the latest edit.
- `text` — **required**. The replacement; empty string just deletes the range.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

The old range content is deleted and the new text inserted at its start in one atomic call. The new text takes the style at `start_index`. All later indexes shift.

## Example request

> Replace the second paragraph of the summary with this shorter version.

## Errors and limitations

The range must not cut across a table cell boundary. Stale indexes hit the wrong text — always re-read first. The deleted content is unrecoverable; the call is never retried automatically after an ambiguous failure.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Find and replace text](./replace-all-text.md) — `replace_all_text`
- [Delete a text range](./delete-range.md) — `delete_range`
- [Read document as text](./read-document-text.md) — `read_document_text`

## Technical details

- **Impact:** destructive operation
- **Group:** Text editing
- **Description source:** `replace_range` registration in `src/tools/text.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
