# Tools

For task-oriented guidance, open the [MCP capability catalog](./capabilities/index.md). This page remains the technical reference for schemas and API responses.

The Google Docs API mixes reads and writes, so every tool carries explicit MCP
annotations: reads are `readOnlyHint`, updates are idempotent-but-overwriting,
content removal is destructive. Inputs use a normalized snake_case vocabulary;
the client maps them to the API's wire values (`HEADING_1`, `BULLET_CHECKBOX`,
`NEXT_PAGE`, computed `fields` masks) and handles OAuth entirely on its own.

`document_id` is the long id from the document URL
(`docs.google.com/document/d/<documentId>/edit`) or from `create_document` output.
**Indexes are UTF-16 code units** counted from the start of each tab's segment;
body content starts at index 1, and every insert/delete shifts all later indexes —
take indexes from a fresh `read_document_text` call, or edit from the end backwards.

## Documents & Markdown

| Tool | Description |
|---|---|
| `create_document` | Creates a doc. Without `markdown`: `documents.create` (accepts ONLY `title`). With `markdown`: a Drive multipart upload with conversion — Markdown becomes native Docs formatting. Returns the `documentId` (Drive `id` for the Markdown path). |
| `get_document` | The raw Docs API document: per-tab body with `startIndex`/`endIndex` on every element, text run styles, `inlineObjects` (image ids), header/footer segment ids, lists, `revisionId`. Verbose — prefer `read_document_text` for content. |
| `read_document_text` | Compact per-tab blocks: paragraphs (`text`, `start`, `end`, heading `style`, `bullet`), tables (`cells[row][col]` text), `[image:<objectId>]` placeholders. The index source for all range tools. |
| `list_tabs` | The tab tree (`tabId`, `title`, `index`, `nestingLevel`, `childTabs`) without content. Tabs **cannot** be created/renamed/deleted/reordered via the API. |
| `export_document` | Drive export. `markdown`/`txt`/`html` inline; `pdf`/`docx`/`odt`/`rtf`/`epub` require `output_path` (absolute; written locally, existing files only replaced with `overwrite=true`). 10 MB cap; comments/suggestions are not exported. |
| `import_markdown` | **Replaces the ENTIRE document body** with Markdown via Drive media upload with conversion. Comment anchors, positioned objects, headers/footers and extra tabs do not survive. |

## Text editing

| Tool | Description |
|---|---|
| `insert_text` | `insertText` at `index`, or `endOfSegmentLocation` (append) when omitted. `\n` starts a new paragraph; text inherits the style at the insertion point. |
| `replace_range` | One atomic batchUpdate: `deleteContentRange` + `insertText` at `start_index`. Empty `text` degrades to a plain delete. Cannot cut across a table cell boundary. |
| `replace_all_text` | `replaceAllText` with literal matching (`match_case` default true), optionally scoped by `tabs_criteria` to `tab_ids`. Returns `occurrencesChanged`. |
| `delete_range` | `deleteContentRange`. Deletes text, inline images (one index each) or whole tables. The tab's final newline cannot be deleted. |

## Styles & lists

| Tool | Description |
|---|---|
| `style_text` | `updateTextStyle` with a computed `fields` mask: bold/italic/underline/strikethrough/small_caps, `font_size` (PT), `font_family` (weightedFontFamily), hex `foreground_color`/`background_color` (rgbColor), `link_url` ("" clears via masked-but-unset `link`), `baseline_offset`. |
| `style_paragraph` | `updateParagraphStyle` with a computed mask: `named_style` → `namedStyleType`, `alignment`, `line_spacing`, `space_above`/`space_below` and indents (PT dimensions), `keep_with_next`, `direction`. |
| `set_paragraph_bullets` | `createParagraphBullets` with a normalized preset (`disc` → `BULLET_DISC_CIRCLE_SQUARE`, `decimal` → `NUMBERED_DECIMAL_ALPHA_ROMAN`, ...) or `deleteParagraphBullets` with `remove=true`. Leading tabs set nesting. |

## Tables

| Tool | Description |
|---|---|
| `insert_table` | `insertTable` rows x columns at an index or the end of the segment. Fill cells with `insert_text` afterwards. |
| `edit_table` | `insertTableRow`/`insertTableColumn`/`deleteTableRow`/`deleteTableColumn`, addressed by `tableStartLocation` (`table_start_index`) + anchor `row_index`/`column_index`. Merge/unmerge, cell styles and pinned header rows → `raw_request`. |

## Structure

| Tool | Description |
|---|---|
| `insert_break` | `kind=page` → `insertPageBreak`; `section_next_page`/`section_continuous` → `insertSectionBreak` with the matching `sectionType`. Not allowed in headers/footers/footnotes/table cells. |

## Images

| Tool | Description |
|---|---|
| `insert_image` | `insertInlineImage` from a **public** URL (PNG/JPEG/GIF, ≤50 MB, ≤25 MP), optional `objectSize` in PT. Returns the created `objectId`. |
| `replace_image` | `replaceImage` (CENTER_CROP) by `image_object_id`, keeping size/position. |

## Comments (Drive API, internal dependency)

| Tool | Description |
|---|---|
| `list_comments` | `drive/v3/files/{id}/comments` with an explicit `fields` selector (author display names only, no emails). Pagination via `page_token`; `include_deleted` shows tombstones. |
| `manage_comment` | `action`: `create` (unanchored; optional `quoted_text` citation — the Docs anchor format is not public), `reply`, `resolve`/`reopen` (a reply with `action`), `delete` (permanent). |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | Calls any Docs API v1 path (`GET`/`POST`, default GET) — e.g. batchUpdate with `mergeTableCells`, `updateSectionStyle`, `updateDocumentStyle`, `createHeader`, `createFootnote`, named ranges or `writeControl.requiredRevisionId`. A path resolving to a foreign origin is rejected (SSRF guard); Drive endpoints are **not** reachable here. |

## Notes

- **Retry policy:** 429 is retried with backoff for every method (the request was rejected
  before executing); 5xx and network errors are retried **only for GET** — replaying a write
  after an ambiguous failure could duplicate it.
- **OAuth:** access tokens are minted from the refresh token automatically, cached until ~60s
  before expiry, and re-minted once on a 401.
- **Scopes:** Docs operations need `https://www.googleapis.com/auth/documents`. Export,
  Markdown import and comments ride on Drive endpoints and need `https://www.googleapis.com/auth/drive`
  (or `drive.file` for documents created by the same OAuth client). Read-only alternatives
  (`documents.readonly`, `drive.readonly`) work for the read tools only.
- **Two hosts, one client:** all wire traffic goes through `src/client.ts` — Docs API on
  `docs.googleapis.com`, Drive dependency on `www.googleapis.com`; tools never see tokens.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_DOCS_CLIENT_ID` | yes* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_DOCS_CLIENT_SECRET` | yes* | — | OAuth2 client secret (refresh flow). Secret. |
| `GOOGLE_DOCS_REFRESH_TOKEN` | yes* | — | OAuth2 refresh token (refresh flow). Secret. |
| `GOOGLE_DOCS_ACCESS_TOKEN` | yes* | — | Alternative: static access token (~1 h lifetime). Secret. |
| `GOOGLE_DOCS_API_BASE` | no | `https://docs.googleapis.com` | Docs API root override. |
| `GOOGLE_DOCS_DRIVE_API_BASE` | no | `https://www.googleapis.com` | Drive API root override (export/markdown/comments). |
| `GOOGLE_DOCS_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_DOCS_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* Either the refresh triple together, or the static access token.
