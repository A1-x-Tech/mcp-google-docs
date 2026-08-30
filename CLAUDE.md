# CLAUDE.md — mcp-google-docs

MCP server for the Google Docs API v1 (TypeScript, stdio). Mixed read/write:
tools cover document creation (incl. from Markdown), reading as text/structure/
Markdown, index-based text editing, character/paragraph styles, lists, tables,
breaks, images, Drive-backed comments and export; `raw_request` is the escape
hatch. The server talks to `https://docs.googleapis.com` with a Bearer token
(the token is minted from an OAuth2 refresh token via
`https://oauth2.googleapis.com/token`, or a static `GOOGLE_DOCS_ACCESS_TOKEN`,
mostly for testing). Export, Markdown conversion and comments have no Docs API
endpoints — the client calls Drive API v3 on `https://www.googleapis.com` as an
internal dependency; no general-purpose Drive tool is exposed.

## Commands

```bash
npm run dev        # run from source (tsx watch)
npm test           # unit tests + dist smoke, no network
npm run typecheck  # types for src + tests
npm run build      # emit dist/
npm run smoke      # live check: read-only by default; GOOGLE_DOCS_SMOKE_LIVE_WRITE=1
                   # runs create→edit→export→delete on a disposable doc (cleanup in finally)
```

## Architecture

- `src/config.ts` — env → config. Credentials: either the refresh triple
  `GOOGLE_DOCS_CLIENT_ID` + `GOOGLE_DOCS_CLIENT_SECRET` + `GOOGLE_DOCS_REFRESH_TOKEN`
  (all three or `ConfigError` `incomplete_oauth_config`) or `GOOGLE_DOCS_ACCESS_TOKEN`;
  optional `GOOGLE_DOCS_API_BASE`, `GOOGLE_DOCS_DRIVE_API_BASE`, `GOOGLE_DOCS_TIMEOUT_MS`,
  `GOOGLE_DOCS_MAX_RETRIES`. No credentials at all is NOT an error: the fields stay
  `undefined` and the server starts degraded. Also home to `CredentialsError` /
  `MISSING_CREDENTIALS_MESSAGE` (opens with the historical startup error verbatim, then
  names the variables and the restart) and `hasCredentials()`.
- `src/client.ts` — all HTTP and all wire mapping for BOTH hosts. Token lifecycle (cache
  until ~60s before expiry, dedupe concurrent refreshes, one forced re-mint + replay on
  401); the private `send()` core resolves the path against the given base and rejects
  foreign origins (SSRF guard), enforces an AbortController timeout that also covers
  reading the body (bytes, because exports are binary), retries 429 always but 5xx/network
  errors **only for GET** — replaying a write after an ambiguous failure would duplicate
  it — and throws `GoogleDocsError(status, body)`. Typed per-endpoint methods build the
  batchUpdate requests and computed `fields` masks; pure exported helpers
  (`buildTextStyle`, `buildParagraphStyle`, `mapBulletPreset`, `hexToRgbColor`,
  `extractBlocks`, `extractDocumentText`, `extractTabTree`) carry the normalized→wire
  vocabulary and the text extraction. Drive methods (`exportDocument`, `importMarkdown`,
  `createDocumentFromMarkdown`, comments, `deleteFile` for smoke cleanup) use the same
  core with the Drive base; `request()` (raw_request surface) is pinned to the Docs base.
- `src/tools/documents.ts` — `create_document`, `get_document`, `read_document_text`,
  `list_tabs`, `export_document`, `import_markdown`.
  `src/tools/text.ts` — `insert_text`, `replace_range`, `replace_all_text`, `delete_range`.
  `src/tools/styles.ts` — `style_text`, `style_paragraph`, `set_paragraph_bullets`.
  `src/tools/tables.ts` — `insert_table`, `edit_table`.
  `src/tools/structure.ts` — `insert_break`. `src/tools/images.ts` — `insert_image`,
  `replace_image`. `src/tools/comments.ts` — `list_comments`, `manage_comment`.
  `src/tools/raw.ts` — `raw_request` (GET/POST, Docs host only). `src/tools/util.ts` —
  `ok`/`fail`, the four annotation presets (`READ_ONLY`/`WRITE`/`UPDATE`/`DESTRUCTIVE`)
  and shared zod schema factories (`documentIdSchema`, `indexSchema`, `tabIdSchema`,
  `segmentIdSchema`, `hexColorSchema`).
- `src/index.ts` — wires every `register*` into the McpServer. `loadConfigOrDegraded()`
  catches `ConfigError`, pings `startup_failed` (fire-and-forget) and degrades the config to
  "no credentials"; an unconfigured start prepends `UNCONFIGURED_PREFIX` — plus
  `Configuration problem: <message>` when a ConfigError was caught — to the initialize
  `instructions`, and `oninitialized` sends `server_start` for a configured install or
  `unconfigured_start` (with the reason) otherwise.
- `src/telemetry.ts` — anonymous usage pings (ids/names/versions only, never data or
  arguments; fire-and-forget, must never block or throw; opt-out `ASKADS_TELEMETRY=0`).
  `server_start` means "a usable install started"; `unconfigured_start` is a degraded start
  and `startup_failed` a malformed config caught at load — both carry a `reason` from a
  closed vocabulary (`missing_credentials`, `incomplete_oauth_config`) — never a variable's
  name or value.

## Conventions (do not break)

- **Never exit because of configuration.** A server that dies before the MCP handshake
  leaves the user with a red cross and no reason. Missing credentials are a survivable
  state: start, answer initialize (with the unconfigured prefix in `instructions`) and
  tools/list, and let the first tool call fail with `CredentialsError` — its message names
  the variables to set and says to restart, because credentials come only from the
  environment. `config.test.ts`, `client.test.ts` and `test/dist-smoke.test.js` pin this.
- **Credential failures are not transport failures.** `CredentialsError` is thrown in
  `accessToken()` before any fetch — before the retry/backoff loop, the token mint and the
  401 replay — because retrying it burns seconds of backoff before the user sees the one
  message that helps. Pinned by the "fetch never called" assertion in `client.test.ts`.
- **Never retry a write on 5xx/network errors.** Only 429 (rejected before executing) and
  GET are safe; the gate lives in `send()` and is pinned by tests.
- **Wire mapping lives in the client, not the tools.** Tools accept the normalized
  snake_case vocabulary and must not know the wire enums (`HEADING_1`, `BULLET_CHECKBOX`,
  `NEXT_PAGE`, `fields` mask paths) — add any mapping in `client.ts`.
- **Auth is the client's job.** Tools never see tokens; the Bearer header, refresh, caching
  and the 401 replay all live in `send()`/`accessToken()`.
- **Drive stays an internal dependency.** Export, Markdown and comments call Drive
  endpoints from typed client methods only. `raw_request` is pinned to the Docs base —
  never widen it to Drive, and never add a general-purpose Drive tool.
- **Indexes are positional and stale after any edit** — descriptions must keep steering the
  model to `read_document_text` before `replace_range`/`delete_range`/style calls, and to
  editing from the end of the document backwards.
- **Validate inputs with zod** in `inputSchema`; reuse the shared schema **factories** in
  `util.ts` (a fresh schema per field avoids `$ref` dedup in the JSON schema).
- **Annotations are pinned per tool** in `annotations.test.ts` — changing one is a conscious
  decision that updates the map, with all four hints always set.
- **Output compact JSON via `ok`** — the consumer is an LLM; pretty-printing burns tokens.
  Responses pass through verbatim (describe the fields in the tool `description`, the only
  place the external model reads).
- **No credentials, tokens or document content in logs or error messages.** Telemetry
  carries names/versions/reasons only.

## Adding a tool

Before changing the tool registry, read [the MCP capability documentation contract](docs/CAPABILITY-DOCUMENTATION.md). Every registered tool must have exactly one task-oriented page in `docs/capabilities/`; update that page, the index, and the coverage test in the same change.

1. Add (or extend) `src/tools/<name>.ts` with `register<Name>Tools(server, client)`.
2. If it hits a new endpoint, add a method to `src/client.ts` with the wire mapping.
3. Import and call the register fn in `src/index.ts`.
4. Add a `*.test.ts` using the mock-fetch (client) / fake-client (tools) harness — no
   network — and add the tool + hints to `annotations.test.ts` and `test/dist-smoke.test.js`.
5. `npm run typecheck && npm test`.

## Releasing

Keep the version in sync across **all** channels in one go (`git push --follow-tags` pushes
the tag but does **not** create a GitHub Release; the registry is immutable per version):

1. Bump `version` in **three places, identically**: `package.json`, and in `server.json`
   **both** the root `version` **and** `packages[0].version`. `mcpName` in `package.json`
   must match `name` in `server.json` (`io.github.A1-x-Tech/mcp-google-docs`). Verify:
   `grep -n '"version"' package.json server.json`.
   > ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. A stale root makes
   > `mcp-publisher publish` fail with a misleading `400 cannot publish duplicate version`
   > while `npm publish` succeeds.
2. Update `CHANGELOG.md`, then `npm publish` (runs typecheck + tests + build via
   `prepublishOnly` / `prepare`; the scope publishes public via `publishConfig`).
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:** `mcp-publisher publish` (login with
   `mcp-publisher login github --token "$(gh auth token)"`).
