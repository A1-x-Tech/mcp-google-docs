# Google Docs: Find and replace text — MCP tool

**Google Docs MCP tool:** Replaces every occurrence of a literal string across the document or chosen tabs.

Technical name: `replace_all_text`

## What task it solves

> I want to find and replace text throughout a document.

Replaces every occurrence of a literal string across the document or chosen tabs.

## When to use it

Use it for textual substitutions that should hit every occurrence — renaming a product, fixing a recurring typo, updating a date. It does not depend on indexes, so it is the safest text mutation.

## What to provide

- `document_id` — **required**.
- `find` — **required**. Literal text (no regex).
- `replace` — **required**. Empty string deletes the occurrences.
- `match_case` — optional, default true.
- `tab_ids` — optional. Limit to specific tabs.

## What it returns

The batchUpdate reply; `occurrencesChanged` says how many replacements were made (0 = not found, not an error).

## What changes in Google Docs

Every matching occurrence in scope is replaced, keeping the surrounding formatting.

## Example request

> Replace every mention of "Project Falcon" with "Project Heron" in this document.

## Errors and limitations

Matching is literal, not regex. Replacing with an empty string across many paragraphs can merge text unexpectedly — check the result. Replaying the same call converges (already-replaced text no longer matches).

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Replace a text range](./replace-range.md) — `replace_range`
- [Read document as text](./read-document-text.md) — `read_document_text`

## Technical details

- **Impact:** destructive operation
- **Group:** Text editing
- **Description source:** `replace_all_text` registration in `src/tools/text.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
