#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleDocsClient } from "./client.js";
import { ConfigError, DEFAULT_BASE, DEFAULT_DRIVE_BASE, hasCredentials, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { GoogleDocsConfig } from "./types.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerTextTools } from "./tools/text.js";
import { registerStyleTools } from "./tools/styles.js";
import { registerTableTools } from "./tools/tables.js";
import { registerStructureTools } from "./tools/structure.js";
import { registerImageTools } from "./tools/images.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerRawTool } from "./tools/raw.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which Google product this API is,
 * what the API refuses to do, and the behaviours that make a naive loop
 * expensive, lossy or duplicating.
 */
const INSTRUCTIONS =
  "Google Docs API v1 reads and edits Google Docs documents — not Sheets, Slides or arbitrary " +
  "Drive files (sharing, renaming and permissions are out of reach; export, Markdown conversion " +
  "and comments ride on Drive endpoints internally and need a Drive scope on the token). All " +
  "edits are index-based: indexes count UTF-16 code units from the start of each tab's body " +
  "(body content starts at index 1), and every insert or delete shifts every later index — " +
  "re-read read_document_text between edits, or apply multiple range edits from the END of the " +
  "document backwards. Tabs can be read and targeted with tab_id, but the API cannot create, " +
  "rename, delete or reorder tabs. Markdown: export_document format=markdown reads the document " +
  "as Markdown; import_markdown REPLACES the entire document body via Drive conversion — " +
  "comments' anchors, positioned objects, headers/footers and extra tabs do not survive the " +
  "round trip. Comments cannot be anchored to a range programmatically (the anchor format is " +
  "not public): manage_comment creates unanchored comments with optional quoted text. Exports " +
  "are capped at 10 MB; inline images need a public URL, <=50 MB, <=25 megapixels, PNG/JPEG/GIF. " +
  "Writes hit a live document and are never retried after a 5xx or timeout: check with " +
  "get_document or read_document_text before re-sending; delete_range and import_markdown are final.";

/**
 * Prepended to INSTRUCTIONS when no credentials are configured. The model reads
 * this before it picks a tool, so an unconfigured session opens with the fix
 * rather than with a failed call. There is no in-chat login here: credentials
 * come only from the environment, so the fix is an operator action + restart.
 */
const UNCONFIGURED_PREFIX =
  "ATTENTION: Google Docs is not connected yet — no credentials are configured, so every " +
  "tool call will fail. The operator must set GOOGLE_DOCS_CLIENT_ID + " +
  "GOOGLE_DOCS_CLIENT_SECRET + GOOGLE_DOCS_REFRESH_TOKEN (recommended), or " +
  "GOOGLE_DOCS_ACCESS_TOKEN with a short-lived access token, in the MCP client's " +
  "server config and restart this server — the variables are read only at startup. ";

/** Reads the package version so the server reports its real version to MCP clients. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Loads the config without dying on a bad value. A server that exits here never
 * completes the MCP handshake, so the user sees a dead server and no reason.
 * Instead the problem is carried into the session, where the model can read it
 * and relay it: the config degrades to "no credentials" and every tool call
 * fails with the actionable message.
 */
function loadConfigOrDegraded(telemetry: Telemetry): {
  config: GoogleDocsConfig;
  problem?: ConfigError;
} {
  try {
    return { config: loadConfig() };
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    // Fire-and-forget now that the process survives: the historical
    // `startup_failed` funnel stays comparable, but nothing blocks startup.
    telemetry.send("startup_failed", { reason: err.reason });
    return {
      config: {
        apiBase: process.env.GOOGLE_DOCS_API_BASE || DEFAULT_BASE,
        driveApiBase: process.env.GOOGLE_DOCS_DRIVE_API_BASE || DEFAULT_DRIVE_BASE,
      },
      problem: err,
    };
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const { config, problem } = loadConfigOrDegraded(telemetry);
  const client = new GoogleDocsClient(config);

  // Decided once, at startup: credentials come only from the environment, so
  // "restart after setting the variables" is the accurate advice to give.
  const connected = hasCredentials(config);

  const server = new McpServer(
    {
      name: "mcp-google-docs",
      version: readVersion(),
    },
    // Surfaces in the initialize result, before the client sees a single tool.
    {
      instructions: connected
        ? INSTRUCTIONS
        : UNCONFIGURED_PREFIX + (problem ? `Configuration problem: ${problem.message} ` : "") + INSTRUCTIONS,
    },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    // Split on purpose: `server_start` keeps meaning "a usable install started",
    // so the unconfigured case gets its own event instead of inflating that number.
    if (connected) telemetry.send("server_start");
    else telemetry.send("unconfigured_start", { reason: problem?.reason ?? "missing_credentials" });
  };

  registerDocumentTools(server, client);
  registerTextTools(server, client);
  registerStyleTools(server, client);
  registerTableTools(server, client);
  registerStructureTools(server, client);
  registerImageTools(server, client);
  registerCommentTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-google-docs running on stdio${connected ? "" : " (no credentials — set the environment variables and restart)"}`,
  );
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-docs:", err);
  process.exit(1);
});
