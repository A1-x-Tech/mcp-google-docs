# Google Docs: Style paragraphs — MCP tool

**Google Docs MCP tool:** Applies paragraph formatting — headings, alignment, spacing, indents — to a range.

Technical name: `style_paragraph`

## What task it solves

> I want to turn paragraphs into headings or change their layout.

Applies paragraph formatting — headings, alignment, spacing, indents — to a range.

## When to use it

Use it to make headings (`named_style` heading_1..heading_6 — these feed the document outline), align text, set line spacing, spacing above/below, indents, keep-with-next and text direction. Affects every paragraph overlapping the range.

## What to provide

- `document_id`, `start_index`, `end_index` — **required**.
- Any of: `named_style` (`normal_text`, `title`, `subtitle`, `heading_1`..`heading_6`), `alignment` (`start`/`center`/`end`/`justified`), `line_spacing` (100 = single), `space_above`/`space_below` (points), `indent_start`/`indent_end`/`indent_first_line` (points), `keep_with_next`, `direction` (`ltr`/`rtl`). At least one is required.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

Only the provided paragraph fields change on every overlapping paragraph. A range inside a single paragraph styles that whole paragraph.

## Example request

> Make the line "Roadmap" a Heading 2 and center it.

## Errors and limitations

Requires at least one style field. Named styles replace manual character styling defaults for the paragraph — apply style_text afterwards if needed.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Style a text range](./style-text.md) — `style_text`
- [Set or remove list bullets](./set-paragraph-bullets.md) — `set_paragraph_bullets`

## Technical details

- **Impact:** destructive operation
- **Group:** Styles and lists
- **Description source:** `style_paragraph` registration in `src/tools/styles.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
