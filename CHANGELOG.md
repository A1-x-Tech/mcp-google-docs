# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## Unreleased

### Changed

- `export_document` is no longer annotated read-only (`readOnlyHint` is now
  `false`): with `output_path` it creates a file on the local machine, and the
  read-only hint must hold for every mode of a tool. The path must be absolute,
  and an existing file is refused with a clear error unless the new
  `overwrite=true` argument is passed (previously the file was silently
  replaced). Google Docs data is still never modified.

## [0.1.0] — 2026-08-30

### Added

- First real release: a full MCP server for the Google Docs API v1 (stdio,
  TypeScript, `@modelcontextprotocol/sdk` + `zod`). Export, Markdown conversion
  and comments use Drive API v3 endpoints as an internal dependency — no
  general-purpose Drive tool is exposed.
- Tools (21):
  - `create_document` — empty via `documents.create`, or from Markdown via Drive
    conversion; `get_document` — the raw structure with every index;
    `read_document_text` — compact per-tab blocks with edit-ready indexes;
    `list_tabs` — the tab tree (the API cannot create or manage tabs);
  - `export_document` — markdown/txt/html inline, pdf/docx/odt/rtf/epub to a
    local file; `import_markdown` — replaces the entire body from Markdown
    (the Markdown round trip's writing half);
  - `insert_text`, `replace_range` (atomic delete+insert), `replace_all_text`,
    `delete_range` — index-based text editing (UTF-16 code units);
  - `style_text`, `style_paragraph` — character/paragraph styles with computed
    `fields` masks; `set_paragraph_bullets` — list presets or bullet removal;
  - `insert_table`, `edit_table` — table shell plus row/column insert/delete;
  - `insert_break` — page and section (next-page/continuous) breaks;
  - `insert_image` (public URL, ≤50 MB, ≤25 MP), `replace_image` (keeps
    size/position);
  - `list_comments`, `manage_comment` — Drive comment threads: create (with
    quoted text), reply, resolve, reopen, delete;
  - `raw_request` — escape hatch to any Docs API v1 path (SSRF-guarded, Docs
    host only).
- Degraded start: without credentials the server still completes the MCP
  handshake, serves the tool list, opens the instructions with the fix and fails
  the first tool call with an actionable `CredentialsError` naming the
  `GOOGLE_DOCS_*` variables.
- OAuth2 refresh flow: access tokens are minted from
  `GOOGLE_DOCS_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`, cached until just
  before expiry, deduped across concurrent requests and re-minted once on a 401;
  a static `GOOGLE_DOCS_ACCESS_TOKEN` works as an alternative.
- Resilience: request timeout covering body reads (binary exports included),
  `Retry-After`-aware backoff, 429 retried for every method, 5xx/network retries
  gated to reads so writes are never replayed.
- Anonymous usage telemetry (event/tool names and versions only; opt out with
  `ASKADS_TELEMETRY=0`), including the `startup_failed` and `unconfigured_start`
  events.
- Offline test suite: mocked-fetch client tests incl. the OAuth flow and the
  Drive endpoints, fake-server tool tests, pinned per-tool annotations, a
  capability-documentation coverage test, plus a dist smoke test that spawns the
  built binary and performs a real MCP handshake over stdio.
- Opt-in live smoke scenario (`GOOGLE_DOCS_SMOKE_LIVE_WRITE=1`) on a disposable
  document with cleanup after success and failure; the default smoke stays
  read-only.
- CI (Node 20/22/24: typecheck + build + tests) and a daily live health check
  that skips itself when repo secrets are absent.

[0.1.0]: https://github.com/A1-x-Tech/mcp-google-docs/releases/tag/v0.1.0
