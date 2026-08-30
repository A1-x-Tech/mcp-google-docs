# Google Docs: Raw Google Docs API call — MCP tool

**Google Docs MCP tool:** Escape hatch to any Google Docs API v1 path for requests without a typed tool.

Technical name: `raw_request`

## What task it solves

> I want to call a Docs API feature the typed tools do not cover.

Escape hatch to any Google Docs API v1 path for requests without a typed tool.

## When to use it

Use it for batchUpdate request types without a typed tool: mergeTableCells, updateTableCellStyle, pinTableHeaderRows, updateSectionStyle, updateDocumentStyle, createHeader/createFooter, createFootnote, named ranges, or several requests atomically with writeControl.requiredRevisionId.

## What to provide

- `path` — **required**. Relative to `https://docs.googleapis.com`, e.g. `v1/documents/<id>:batchUpdate`.
- `method` — optional, `GET` (default) or `POST`.
- `body` — optional JSON body for POST.

## What it returns

The raw API response for the path.

## What changes in Google Docs

Whatever the request does — up to and including destructive batchUpdate operations. Annotated for the worst case a call can perform.

## Example request

> Merge the first two cells of the header row via a raw batchUpdate.

## Errors and limitations

Only docs.googleapis.com paths are reachable: a path resolving to a foreign origin is rejected before the Bearer token is attached (SSRF guard), and Drive endpoints are not exposed here. Writes are never retried after an ambiguous failure.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get document structure](./get-document.md) — `get_document`
- [Edit table rows and columns](./edit-table.md) — `edit_table`
- [Insert a page or section break](./insert-break.md) — `insert_break`

## Technical details

- **Impact:** destructive operation
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/raw.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
