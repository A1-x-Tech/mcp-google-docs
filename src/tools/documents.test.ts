import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerDocumentTools } from "./documents.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string, result: unknown = { ok: true }) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return result;
    };
  const client = {
    createDocument: make("createDocument"),
    createDocumentFromMarkdown: make("createDocumentFromMarkdown"),
    getDocument: make("getDocument"),
    readDocumentText: make("readDocumentText"),
    listTabs: make("listTabs"),
    exportDocument: make("exportDocument", new TextEncoder().encode("# exported md")),
    importMarkdown: make("importMarkdown"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerDocumentTools(server as never, client as never);
  return { calls, tools };
}

test("registers the six document tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "create_document",
    "export_document",
    "get_document",
    "import_markdown",
    "list_tabs",
    "read_document_text",
  ]);
});

test("create_document without markdown uses documents.create", async () => {
  const { calls, tools } = harness();
  await tools.create_document({ title: "Report" });
  assert.equal(calls[0].method, "createDocument");
  assert.deepEqual(calls[0].params, ["Report"]);
});

test("create_document with markdown uses the Drive conversion path", async () => {
  const { calls, tools } = harness();
  await tools.create_document({ title: "Report", markdown: "# Hi" });
  assert.equal(calls[0].method, "createDocumentFromMarkdown");
  assert.deepEqual(calls[0].params[0], { title: "Report", markdown: "# Hi" });
});

test("get_document defaults include_tabs_content to true", async () => {
  const { calls, tools } = harness();
  await tools.get_document({ document_id: "d1" });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d1",
    includeTabsContent: true,
    suggestionsViewMode: undefined,
  });
});

test("read_document_text and list_tabs forward normalized params", async () => {
  const { calls, tools } = harness();
  await tools.read_document_text({ document_id: "d1", tab_id: "t.0" });
  assert.deepEqual(calls[0].params[0], { documentId: "d1", tabId: "t.0" });
  await tools.list_tabs({ document_id: "d1" });
  assert.deepEqual(calls[1].params, ["d1"]);
});

test("export_document returns text formats inline", async () => {
  const { calls, tools } = harness();
  const res = await tools.export_document({ document_id: "d1", format: "markdown" });
  assert.equal(res.isError, undefined);
  assert.equal(res.content[0].text, "# exported md");
  assert.deepEqual(calls[0].params[0], { documentId: "d1", format: "markdown" });
});

test("export_document writes to output_path and reports the byte count", async () => {
  const { tools } = harness();
  const dir = mkdtempSync(join(tmpdir(), "docs-export-"));
  const path = join(dir, "out.md");
  const res = await tools.export_document({ document_id: "d1", format: "markdown", output_path: path });
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.saved_to, path);
  assert.equal(payload.bytes, new TextEncoder().encode("# exported md").byteLength);
  assert.equal(readFileSync(path, "utf8"), "# exported md");
});

test("export_document refuses a relative output_path before calling the API", async () => {
  const { calls, tools } = harness();
  const res = await tools.export_document({
    document_id: "d1",
    format: "markdown",
    output_path: "relative/out.md",
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /absolute/);
  assert.equal(calls.length, 0, "must not export before the path is validated");
});

test("export_document refuses to overwrite an existing file without overwrite=true", async () => {
  const { tools } = harness();
  const dir = mkdtempSync(join(tmpdir(), "docs-export-"));
  const path = join(dir, "out.md");
  writeFileSync(path, "precious local data");
  const res = await tools.export_document({ document_id: "d1", format: "markdown", output_path: path });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /already exists/);
  assert.match(res.content[0].text, /overwrite=true/);
  assert.equal(readFileSync(path, "utf8"), "precious local data", "existing file must survive");
});

test("export_document overwrite=true replaces the existing file", async () => {
  const { tools } = harness();
  const dir = mkdtempSync(join(tmpdir(), "docs-export-"));
  const path = join(dir, "out.md");
  writeFileSync(path, "old content");
  const res = await tools.export_document({
    document_id: "d1",
    format: "markdown",
    output_path: path,
    overwrite: true,
  });
  assert.equal(res.isError, undefined);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.saved_to, path);
  assert.equal(readFileSync(path, "utf8"), "# exported md");
});

test("export_document refuses a binary format without output_path", async () => {
  const { tools } = harness();
  const res = await tools.export_document({ document_id: "d1", format: "pdf" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /output_path/);
});

test("import_markdown forwards the full replacement content", async () => {
  const { calls, tools } = harness();
  await tools.import_markdown({ document_id: "d1", markdown: "# New body" });
  assert.deepEqual(calls[0].params[0], { documentId: "d1", markdown: "# New body" });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "createDocument" });
  const res = await tools.create_document({ title: "Report" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
