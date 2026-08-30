# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Docs MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/%40a1-x-tech%2Fmcp-google-docs)](https://www.npmjs.com/package/@a1-x-tech/mcp-google-docs)
[![CI](https://github.com/A1-x-Tech/mcp-google-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-docs/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-docs/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-docs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Docs MCP** lets an AI app read and edit Google Docs in plain language. Read a document as text or Markdown, change an exact passage, style headings, lists and tables, work through comment threads and export the result to PDF or DOCX.

It uses the Google Docs API with your Google account. It edits by exact index ranges rather than by guesswork, and makes the limits of the Docs API explicit instead of implying that every document task is possible.

- **21 tools.** Read a document as text, structure or Markdown, edit exact ranges, style characters and paragraphs, manage lists, tables, breaks, images and comment threads, and export to PDF, DOCX and more.
- **Edits are surgical.** Changes address exact index ranges, and the server steers the assistant to re-read the document before every edit, because each change shifts the indexes after it.
- **Markdown both ways.** Create a document from Markdown or export to Markdown, PDF, DOCX and other formats; replacing a whole document with Markdown is a separate, explicitly destructive step.
- **No hidden Drive surface.** Export, Markdown conversion and comments use Drive endpoints internally, but the server exposes no general-purpose Drive tool.

Start with a read-only question:

> Read the launch plan document and summarize its unresolved comment threads.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** Show me the text and comments of the launch plan document.
>
> **Assistant:** Reads the document as compact text blocks and lists its comment threads. Nothing changes.
>
> **You:** Rewrite the “Timeline” paragraph to say the beta starts on March 3.
>
> **Assistant:** Shows the exact range it will replace and the proposed text, then asks for confirmation before editing.
>
> **You:** Confirm.
>
> **Assistant:** Replaces that one range. The rest of the document, its formatting and its comments stay as they were.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How a document changes](#how-a-document-changes)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google account and OAuth credentials from a Google Cloud project with the Google Docs API and the Google Drive API enabled.

1. [Prepare Google OAuth access](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → MCP servers**, select **Add server**, choose **STDIO**, enter the command `npx -y @a1-x-tech/mcp-google-docs@latest` and environment variables `GOOGLE_DOCS_CLIENT_ID`, `GOOGLE_DOCS_CLIENT_SECRET`, `GOOGLE_DOCS_REFRESH_TOKEN`, then select **Save** and **Restart**.

**From the command line:**

```bash
codex mcp add google-docs \
  --env GOOGLE_DOCS_CLIENT_ID=your_client_id \
  --env GOOGLE_DOCS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_DOCS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @a1-x-tech/mcp-google-docs@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_DOCS_CLIENT_ID=your_client_id \
  --env GOOGLE_DOCS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_DOCS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-docs \
  -- npx -y @a1-x-tech/mcp-google-docs@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

The current official path is **Settings → Extensions**. For a custom desktop extension, open **Advanced settings → Extension Developer → Install Extension…**, select a `.mcpb` file and follow the prompts.

This repository currently publishes an npm stdio package and does not contain a `.mcpb` bundle. For Claude Desktop builds that still support local configuration, use the following JSON stdio configuration as a fallback:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "your_client_id",
        "GOOGLE_DOCS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_DOCS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

In those builds, save it to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "your_client_id",
        "GOOGLE_DOCS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_DOCS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "${input:docs_client_id}",
        "GOOGLE_DOCS_CLIENT_SECRET": "${input:docs_client_secret}",
        "GOOGLE_DOCS_REFRESH_TOKEN": "${input:docs_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "docs_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "docs_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "docs_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### Read and export a document

- Read this document as text with headings and tables, and summarize it.
- Show the tab tree of the handbook document.
- Export the spec as Markdown; save the contract as a PDF file.

### Write and edit text

- Create a meeting-notes document from this Markdown.
- Insert a summary paragraph after the introduction.
- Replace every “Q3” with “Q4” across the document.
- Delete the outdated pricing section.

### Format and structure

- Turn these paragraphs into a numbered list; make this line a level-2 heading.
- Bold the key terms and link them to the glossary.
- Insert a 3×4 table for the roadmap and fill in the header row.
- Add a page break before the appendix; insert an image from a public URL.

### Work with comments

- List the open comment threads and summarize them.
- Reply to the comment about the deadline and mark it resolved.
- Add a comment quoting the sentence that needs legal review.

## How a document changes

1. `create_document` creates a **document** — empty, or converted from Markdown in one call.
2. Content is addressed by **indexes** — UTF-16 positions inside a tab’s body — and every insert or delete shifts all later indexes. The server steers the assistant to take fresh indexes from `read_document_text` before each edit and to edit from the end of the document backwards.
3. `import_markdown` replaces the **entire body**: comment anchors, positioned objects, headers/footers and extra tabs do not survive the conversion.
4. **Tabs** can be read and targeted, but the API cannot create, rename, delete or reorder them.
5. **Comments** live in Drive and are managed as threads. A new comment cannot be anchored to a text range — the anchor format is not public — so it attaches at document level, optionally quoting the text it refers to.

Exports are capped at 10 MB and do not include comments or suggestions. Inline images are fetched by Google from a public URL (PNG/JPEG/GIF, up to 50 MB and 25 megapixels); there is no channel for uploading image files.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Read a document, its tabs or comments | Reads content and structure | No change |
| Export a document | Writes a local file when `output_path` is set; the document itself is untouched | Changes local files only |
| Create a document | Adds a new document | Changes Google Docs |
| Insert text, a table, a break or an image | Adds content | Changes a document |
| Style text or paragraphs, manage bullets | Overwrites formatting on a range | Changes a document |
| Replace or delete a range, find and replace | Removes existing content | Destructive |
| Replace the whole document with Markdown | Replaces the entire body | Destructive |
| Manage comments | Creates, replies, resolves or permanently deletes | Potentially destructive |
| Raw API request | Can call API methods without a dedicated tool | Potentially destructive |

The AI client controls confirmation prompts. The server marks reads, writes and destructive tools so the client can distinguish an inspection from a live change.

## Getting access

Google Docs requires OAuth 2.0; an API key is not enough.

1. Create or select a Google Cloud project and enable both the **Google Docs API** and the **Google Drive API** (export, Markdown conversion and comments go through Drive endpoints).
2. Configure the OAuth consent screen and create a **Desktop app** OAuth client.
3. Authorize the Google account that owns or can edit the documents. The [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) can obtain the refresh token when **Use your own OAuth credentials** is enabled.
4. Request both scopes:

   ```text
   https://www.googleapis.com/auth/documents
   https://www.googleapis.com/auth/drive
   ```

   For a narrower setup, `drive.file` is enough when export, Markdown and comments only touch documents created through this OAuth client, and the read-only pair `documents.readonly` + `drive.readonly` is enough for the read-only tools.

Testing-mode OAuth refresh tokens can expire after seven days. Publish the OAuth app, or use an Internal app in a Workspace domain, when you need long-lived access. Treat the client secret and refresh token as passwords.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_DOCS_CLIENT_ID` | Yes* | OAuth client ID. |
| `GOOGLE_DOCS_CLIENT_SECRET` | Yes* | OAuth client secret. |
| `GOOGLE_DOCS_REFRESH_TOKEN` | Yes* | OAuth refresh token. |
| `GOOGLE_DOCS_ACCESS_TOKEN` | Yes* | Short-lived alternative to the OAuth trio (~1 hour). |
| `GOOGLE_DOCS_API_BASE` | No | Google Docs API base URL override. |
| `GOOGLE_DOCS_DRIVE_API_BASE` | No | Drive API base URL override (export, Markdown, comments). |
| `GOOGLE_DOCS_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_DOCS_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token.

## Data, limits and background work

- **Requests go to Google.** The local server refreshes Google OAuth tokens and calls the Docs API; export, Markdown conversion and comments use Drive API endpoints internally. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, document content, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies per-minute quotas.** On `429`, the server backs off and retries; reads also retry after network and `5xx` errors, while writes are never replayed after an uncertain failure — a replayed write could duplicate the edit.
- **There is no background polling.** The server runs only when called. If your AI app supports scheduled tasks, it can check a document or its comments periodically.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Docs API reference](https://developers.google.com/docs/api)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-docs/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
