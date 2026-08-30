import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTextTools } from "./text.js";

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
    insertText: make("insertText"),
    replaceRange: make("replaceRange"),
    replaceAllText: make("replaceAllText"),
    deleteRange: make("deleteRange"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerTextTools(server as never, client as never);
  return { calls, tools };
}

test("registers the four text tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "delete_range",
    "insert_text",
    "replace_all_text",
    "replace_range",
  ]);
});

test("insert_text forwards text, index and tab addressing normalized", async () => {
  const { calls, tools } = harness();
  await tools.insert_text({ document_id: "d", text: "hi", index: 5, tab_id: "t.0", segment_id: "s1" });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    text: "hi",
    index: 5,
    tabId: "t.0",
    segmentId: "s1",
  });
});

test("replace_range forwards the range and rejects an empty one", async () => {
  const { calls, tools } = harness();
  await tools.replace_range({ document_id: "d", start_index: 3, end_index: 9, text: "new" });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    startIndex: 3,
    endIndex: 9,
    text: "new",
    tabId: undefined,
    segmentId: undefined,
  });

  const res = await tools.replace_range({ document_id: "d", start_index: 9, end_index: 3, text: "x" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /end_index must be greater/);
  assert.equal(calls.length, 1, "an invalid range must not reach the client");
});

test("replace_all_text forwards find/replace/match_case/tab_ids", async () => {
  const { calls, tools } = harness();
  await tools.replace_all_text({
    document_id: "d",
    find: "old",
    replace: "new",
    match_case: false,
    tab_ids: ["t.0"],
  });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    find: "old",
    replace: "new",
    matchCase: false,
    tabIds: ["t.0"],
  });
});

test("delete_range forwards the range and rejects an empty one", async () => {
  const { calls, tools } = harness();
  await tools.delete_range({ document_id: "d", start_index: 1, end_index: 4 });
  assert.equal(calls[0].method, "deleteRange");

  const res = await tools.delete_range({ document_id: "d", start_index: 4, end_index: 4 });
  assert.equal(res.isError, true);
  assert.equal(calls.length, 1);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "insertText" });
  const res = await tools.insert_text({ document_id: "d", text: "hi" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
