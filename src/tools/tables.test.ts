import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTableTools } from "./tables.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { ok: true };
    };
  const client = {
    insertTable: make("insertTable"),
    editTable: make("editTable"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerTableTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two table tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["edit_table", "insert_table"]);
});

test("insert_table forwards size and position normalized", async () => {
  const { calls, tools } = harness();
  await tools.insert_table({ document_id: "d", rows: 2, columns: 3, index: 7, tab_id: "t.0" });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    rows: 2,
    columns: 3,
    index: 7,
    tabId: "t.0",
    segmentId: undefined,
  });
});

test("edit_table forwards the action and anchor cell normalized", async () => {
  const { calls, tools } = harness();
  await tools.edit_table({
    document_id: "d",
    action: "insert_row",
    table_start_index: 7,
    row_index: 1,
    insert_below: false,
  });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    action: "insert_row",
    tableStartIndex: 7,
    rowIndex: 1,
    columnIndex: undefined,
    insertBelow: false,
    insertRight: undefined,
    tabId: undefined,
  });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "editTable" });
  const res = await tools.edit_table({ document_id: "d", action: "delete_row", table_start_index: 7 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
