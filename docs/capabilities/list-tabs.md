# Google Docs: List document tabs — MCP tool

**Google Docs MCP tool:** Returns the document's tab tree — ids, titles and nesting — without content.

Technical name: `list_tabs`

## What task it solves

> I want to see which tabs a document has.

Returns the document's tab tree — ids, titles and nesting — without content.

## When to use it

Use it when a document has multiple tabs and you need their ids to scope reading or editing (`tab_id` parameters). Documents created through the API have a single tab; tabs are added by users in the Docs UI.

## What to provide

- `document_id` — **required**.

## What it returns

The tab tree: `tabId`, `title`, position `index`, `nestingLevel` and nested `childTabs`.

## What changes in Google Docs

Nothing — the tool reads Google Docs data and does not change it.

## Example request

> List the tabs of this planning document so we can edit only the Budget tab.

## Errors and limitations

The Docs API cannot create, rename, delete or reorder tabs — that is UI-only. This tool only discovers what exists.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Read document as text](./read-document-text.md) — `read_document_text`
- [Get document structure](./get-document.md) — `get_document`

## Technical details

- **Impact:** read-only
- **Group:** Documents and Markdown
- **Description source:** `list_tabs` registration in `src/tools/documents.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
