# Google Docs: Style a text range — MCP tool

**Google Docs MCP tool:** Applies character formatting — bold, fonts, colors, links — to an index range.

Technical name: `style_text`

## What task it solves

> I want to format a passage of text.

Applies character formatting — bold, fonts, colors, links — to an index range.

## When to use it

Use it after inserting or locating text: bold/italic/underline/strikethrough, small caps, font size and family, text and highlight colors, links (or link removal) and superscript/subscript. Styling does not shift indexes, so several calls can reuse the same coordinates.

## What to provide

- `document_id`, `start_index`, `end_index` — **required**.
- Any of: `bold`, `italic`, `underline`, `strikethrough`, `small_caps` (booleans), `font_size` (points), `font_family`, `foreground_color` / `background_color` (6-digit hex), `link_url` (empty string removes a link), `baseline_offset` (`none`/`superscript`/`subscript`). At least one is required.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

Only the provided style fields change on the range (the fields mask is computed); explicit `false` turns a toggle off. Other formatting is untouched.

## Example request

> Make the phrase "due Friday" bold and red in the status update.

## Errors and limitations

Requires at least one style field. Colors must be 6-digit hex. Replaying the same style converges (idempotent), but the range must still be current.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Style paragraphs](./style-paragraph.md) — `style_paragraph`
- [Read document as text](./read-document-text.md) — `read_document_text`

## Technical details

- **Impact:** destructive operation
- **Group:** Styles and lists
- **Description source:** `style_text` registration in `src/tools/styles.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
