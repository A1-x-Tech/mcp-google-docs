# Google Docs: Insert a page or section break — MCP tool

**Google Docs MCP tool:** Inserts a page break or starts a new section at a chosen position.

Technical name: `insert_break`

## What task it solves

> I want to start a new page or section.

Inserts a page break or starts a new section at a chosen position.

## When to use it

Use `kind=page` to push following content to a new page; `section_next_page` / `section_continuous` start a new section (sections carry their own margins and column settings, editable via `raw_request` updateSectionStyle).

## What to provide

- `document_id` — **required**.
- `kind` — **required**: `page`, `section_next_page`, `section_continuous`.
- `index` — optional insertion point; omit to append at the end of the body.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

A break element is inserted, occupying one index position; later indexes shift by one.

## Example request

> Insert a page break before the appendix heading.

## Errors and limitations

Breaks cannot go into headers, footers, footnotes or table cells. Remove a break by deleting its one-index range with delete_range.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Delete a text range](./delete-range.md) — `delete_range`
- [Raw Google Docs API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** changes data
- **Group:** Structure
- **Description source:** `insert_break` registration in `src/tools/structure.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
