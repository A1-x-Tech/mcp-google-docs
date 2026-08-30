# Google Docs MCP capabilities

This catalog contains 21 public pages—one for every registered MCP tool in `mcp-google-docs`. Each page starts with the user's task, explains the result, and states whether the call changes real data.

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Documents and Markdown

- [Create a document](./create-document.md) — Creates a new Google Doc — empty, or converted from Markdown in one call. **Impact:** changes data.
- [Export a document](./export-document.md) — Exports the document as Markdown, text, HTML or a binary file format. **Impact:** changes data (writes a local file when `output_path` is set; Google Docs itself is untouched).
- [Get document structure](./get-document.md) — Returns the raw Docs API document with every structural element and index. **Impact:** read-only.
- [Replace document with Markdown](./import-markdown.md) — Replaces the entire document body with new Markdown via Drive conversion. **Impact:** destructive operation.
- [List document tabs](./list-tabs.md) — Returns the document's tab tree — ids, titles and nesting — without content. **Impact:** read-only.
- [Read document as text](./read-document-text.md) — Returns the document as compact readable blocks with edit-ready indexes. **Impact:** read-only.

## Text editing

- [Delete a text range](./delete-range.md) — Deletes the content between two indexes — text, images or whole tables. **Impact:** destructive operation.
- [Insert text](./insert-text.md) — Inserts plain text at an index or appends it at the end of the body. **Impact:** changes data.
- [Find and replace text](./replace-all-text.md) — Replaces every occurrence of a literal string across the document or chosen tabs. **Impact:** destructive operation.
- [Replace a text range](./replace-range.md) — Replaces one exact index range with new text in a single atomic batchUpdate. **Impact:** destructive operation.

## Styles and lists

- [Set or remove list bullets](./set-paragraph-bullets.md) — Turns paragraphs into a bulleted or numbered list, or strips their bullets. **Impact:** destructive operation.
- [Style paragraphs](./style-paragraph.md) — Applies paragraph formatting — headings, alignment, spacing, indents — to a range. **Impact:** destructive operation.
- [Style a text range](./style-text.md) — Applies character formatting — bold, fonts, colors, links — to an index range. **Impact:** destructive operation.

## Tables

- [Edit table rows and columns](./edit-table.md) — Inserts or deletes a row or column of an existing table. **Impact:** destructive operation.
- [Insert a table](./insert-table.md) — Inserts an empty rows x columns table at an index or the end of the body. **Impact:** changes data.

## Structure

- [Insert a page or section break](./insert-break.md) — Inserts a page break or starts a new section at a chosen position. **Impact:** changes data.

## Images

- [Insert an image](./insert-image.md) — Inserts an inline image fetched by Google from a public URL. **Impact:** changes data.
- [Replace an image](./replace-image.md) — Swaps an existing image's contents for a new one, keeping size and position. **Impact:** destructive operation.

## Comments

- [List comments](./list-comments.md) — Lists the document's comment threads with replies and resolution state. **Impact:** read-only.
- [Create, reply to, resolve or delete a comment](./manage-comment.md) — Creates comments, replies to threads, resolves/reopens them or deletes them. **Impact:** destructive operation.

## Additional API methods

- [Raw Google Docs API call](./raw-request.md) — Escape hatch to any Google Docs API v1 path for requests without a typed tool. **Impact:** destructive operation.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-docs)
