import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleDocsClient } from "../dist/client.js";
import { registerDocumentTools } from "../dist/tools/documents.js";
import { registerTextTools } from "../dist/tools/text.js";
import { registerStyleTools } from "../dist/tools/styles.js";
import { registerTableTools } from "../dist/tools/tables.js";
import { registerStructureTools } from "../dist/tools/structure.js";
import { registerImageTools } from "../dist/tools/images.js";
import { registerCommentTools } from "../dist/tools/comments.js";
import { registerRawTool } from "../dist/tools/raw.js";

const ALL_TOOLS = [
  "create_document",
  "delete_range",
  "edit_table",
  "export_document",
  "get_document",
  "import_markdown",
  "insert_break",
  "insert_image",
  "insert_table",
  "insert_text",
  "list_comments",
  "list_tabs",
  "manage_comment",
  "raw_request",
  "read_document_text",
  "replace_all_text",
  "replace_image",
  "replace_range",
  "set_paragraph_bullets",
  "style_paragraph",
  "style_text",
];

test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleDocsClient({
      accessToken: "SECRET",
      apiBase: "https://docs.googleapis.com",
      driveApiBase: "https://www.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("GET", "https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the Bearer token and JSON bodies", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response('{"documentId":"d-1"}', { status: 200 });
  };
  try {
    const client = new GoogleDocsClient({
      accessToken: "SECRET",
      apiBase: "https://docs.googleapis.com",
      driveApiBase: "https://www.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await client.createDocument("Smoke");
    assert.equal(seen.url, "https://docs.googleapis.com/v1/documents");
    assert.equal(seen.auth, "Bearer SECRET");
    assert.deepEqual(seen.body, { title: "Smoke" });
  } finally {
    globalThis.fetch = original;
  }
});

test("dist registers the expected tools", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerDocumentTools(server, client);
  registerTextTools(server, client);
  registerStyleTools(server, client);
  registerTableTools(server, client);
  registerStructureTools(server, client);
  registerImageTools(server, client);
  registerCommentTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_DOCS_ACCESS_TOKEN: "test-token",
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-docs");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Google Docs API v1/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const getDocument = tools.find((t) => t.name === "get_document");
    assert.equal(getDocument.annotations?.readOnlyHint, true);
    assert.ok(getDocument.inputSchema?.properties?.document_id, "input schema must reach the client");
  } finally {
    await client.close();
  }
});

/**
 * The degraded-start contract: without any credentials the binary must not
 * exit before the handshake and leave the client a dead server with no reason.
 * It must start, list every tool, open the instructions with the fix, and
 * answer a tool call with the actionable error — offline: the CredentialsError
 * fires before any fetch, so this test never touches the network.
 */
test("dist binary starts without credentials: handshake, tool list, actionable call error", async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("GOOGLE_DOCS_"),
    ),
  );
  env.ASKADS_TELEMETRY = "0"; // keep the suite offline
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke-unconfigured", version: "0.0.0" });
  await client.connect(transport);
  try {
    // The model must read the fix before it picks a tool.
    const instructions = client.getInstructions() ?? "";
    assert.match(instructions, /not connected/);
    assert.match(instructions, /GOOGLE_DOCS_CLIENT_ID/);
    assert.match(instructions, /restart/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    // A tool call fails with the exact message instead of killing the server.
    const result = await client.callTool({ name: "get_document", arguments: { document_id: "smoke-doc" } });
    assert.equal(result.isError, true);
    const text = result.content.map((c) => c.text ?? "").join(" ");
    assert.match(text, /Google OAuth credentials are required: set GOOGLE_DOCS_CLIENT_ID/);
    assert.match(text, /restart the server/);
  } finally {
    await client.close();
  }
});
