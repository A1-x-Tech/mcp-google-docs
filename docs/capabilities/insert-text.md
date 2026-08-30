# Google Docs: Insert text — MCP tool

**Google Docs MCP tool:** Inserts plain text at an index or appends it at the end of the body.

Technical name: `insert_text`

## What task it solves

> I want to add text to a document.

Inserts plain text at an index or appends it at the end of the body.

## When to use it

Use it to append or insert plain text — new paragraphs, list items to style later, cell content of a fresh table. Take the insertion index from `read_document_text`; omit it to append at the end.

## What to provide

- `document_id` — **required**.
- `text` — **required**. `\n` starts a new paragraph.
- `index` — optional. Insertion index (UTF-16 code units; body starts at 1). Omit to append.
- `tab_id`, `segment_id` — optional addressing (tab; header/footer/footnote segment).

## What it returns

The batchUpdate reply with the document's new `revisionId`.

## What changes in Google Docs

Text is inserted at the given position and inherits the style at the insertion point. Every later index shifts by the inserted length.

## Example request

> Append a "Next steps" paragraph to the end of the meeting notes.

## Errors and limitations

Indexes from before any previous edit are stale — re-read first, or apply multiple edits from the end of the document backwards. Not retried after an ambiguous failure: verify with read_document_text before re-sending or the text may double.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Replace a text range](./replace-range.md) — `replace_range`
- [Style a text range](./style-text.md) — `style_text`
- [Read document as text](./read-document-text.md) — `read_document_text`

## Technical details

- **Impact:** changes data
- **Group:** Text editing
- **Description source:** `insert_text` registration in `src/tools/text.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
