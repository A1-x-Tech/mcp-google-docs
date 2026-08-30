# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Docs MCP

[![CI](https://github.com/A1-x-Tech/mcp-google-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-docs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

MCP server for the **Google Docs API v1** (TypeScript, stdio). Reads documents as
text, structure or Markdown; edits text by index ranges; applies character and
paragraph styles, lists, tables, breaks and images; manages Drive-backed comment
threads; exports to Markdown/PDF/DOCX and more. Export, Markdown conversion and
comments use Drive API v3 endpoints internally — no general-purpose Drive tool is
exposed.

> Technical README for the development handover. The public-facing README,
> marketing copy and store listings are a separate follow-up task.

## Quick start

```bash
npm install
npm run build
GOOGLE_DOCS_CLIENT_ID=... GOOGLE_DOCS_CLIENT_SECRET=... GOOGLE_DOCS_REFRESH_TOKEN=... \
  node dist/index.js
```

Or in an MCP client config:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "…",
        "GOOGLE_DOCS_CLIENT_SECRET": "…",
        "GOOGLE_DOCS_REFRESH_TOKEN": "…"
      }
    }
  }
}
```

Without credentials the server still starts, completes the MCP handshake and
lists every tool; the first tool call fails with a message naming the exact
variables to set. Credentials are read only at startup.

## OAuth scopes

- `https://www.googleapis.com/auth/documents` — all Docs read/write tools.
- `https://www.googleapis.com/auth/drive` — export, Markdown import and comments
  (`drive.file` suffices for documents created by the same OAuth client;
  `documents.readonly`/`drive.readonly` work for the read-only tools).

## Tools (21)

| Group | Tools |
|---|---|
| Documents & Markdown | `create_document`, `get_document`, `read_document_text`, `list_tabs`, `export_document`, `import_markdown` |
| Text editing | `insert_text`, `replace_range`, `replace_all_text`, `delete_range` |
| Styles & lists | `style_text`, `style_paragraph`, `set_paragraph_bullets` |
| Tables | `insert_table`, `edit_table` |
| Structure | `insert_break` |
| Images | `insert_image`, `replace_image` |
| Comments | `list_comments`, `manage_comment` |
| Escape hatch | `raw_request` |

Details: [docs/TOOLS.md](./docs/TOOLS.md) · task-oriented pages:
[docs/capabilities/](./docs/capabilities/index.md).

## Environment variables

`GOOGLE_DOCS_CLIENT_ID` + `GOOGLE_DOCS_CLIENT_SECRET` + `GOOGLE_DOCS_REFRESH_TOKEN`
(recommended) or `GOOGLE_DOCS_ACCESS_TOKEN`; optional `GOOGLE_DOCS_API_BASE`,
`GOOGLE_DOCS_DRIVE_API_BASE`, `GOOGLE_DOCS_TIMEOUT_MS`, `GOOGLE_DOCS_MAX_RETRIES`.
Full table: [docs/TOOLS.md](./docs/TOOLS.md#environment-variables).

## Known Docs API limits (fixed for the next stage)

- Indexes are UTF-16 code units and shift on every edit — re-read between edits.
- Tabs are read/target only: the API cannot create, rename, delete or reorder them.
- `import_markdown` replaces the whole body; comment anchors, positioned objects,
  headers/footers and extra tabs do not survive the Markdown round trip.
- New comments cannot be anchored to a text range (the Drive anchor format for
  Docs is not public) — they attach at document level with optional quoted text.
- Exports are capped at 10 MB; inline images need a public URL (≤50 MB, ≤25 MP,
  PNG/JPEG/GIF) — there is no image upload channel.
- Writes are never retried after a 5xx/timeout (duplication risk); 429 is always
  retried with backoff.

## Development

```bash
npm run typecheck && npm test   # the gate; offline
npm run smoke                   # live read-only check
GOOGLE_DOCS_SMOKE_LIVE_WRITE=1 npm run smoke  # opt-in disposable-doc scenario with cleanup
```

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) and
[docs/PUBLISHING.md](./docs/PUBLISHING.md). Anonymous usage telemetry: see
[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md#usage-telemetry); opt out with
`ASKADS_TELEMETRY=0`.

## License

[MIT](./LICENSE) © A1 x Tech
