# Google Docs: Set or remove list bullets — MCP tool

**Google Docs MCP tool:** Turns paragraphs into a bulleted or numbered list, or strips their bullets.

Technical name: `set_paragraph_bullets`

## What task it solves

> I want to make a list out of paragraphs.

Turns paragraphs into a bulleted or numbered list, or strips their bullets.

## When to use it

Use it after inserting the item lines with `insert_text` (one paragraph per item; leading tabs create nesting levels). Apply a bullet preset over the range, or `remove=true` to turn a list back into plain paragraphs.

## What to provide

- `document_id`, `start_index`, `end_index` — **required**.
- `preset` — one of `disc`, `arrow`, `checkbox`, `star`, `diamond` (bulleted) or `decimal`, `decimal_parens`, `decimal_nested`, `upper_alpha`, `upper_roman`, `zero_decimal` (numbered).
- `remove` — `true` strips existing bullets. Exactly one of `preset`/`remove` is required.
- `tab_id` — optional.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

Every paragraph overlapping the range joins (or leaves) a list. Leading tab characters are consumed as nesting levels when bullets are applied.

## Example request

> Turn these five lines into a checkbox list.

## Errors and limitations

Passing both `preset` and `remove`, or neither, is rejected before any API call. Nesting depends on leading tabs already present in the text.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert text](./insert-text.md) — `insert_text`
- [Style paragraphs](./style-paragraph.md) — `style_paragraph`

## Technical details

- **Impact:** destructive operation
- **Group:** Styles and lists
- **Description source:** `set_paragraph_bullets` registration in `src/tools/styles.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
