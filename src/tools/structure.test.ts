import { test } from "node:test";
import assert from "node:assert/strict";
import { registerStructureTools } from "./structure.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const client = {
    insertBreak: async (...params: unknown[]) => {
      calls.push({ method: "insertBreak", params });
      if (opts.throwOn === "insertBreak") throw new Error("boom");
      return { ok: true };
    },
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerStructureTools(server as never, client as never);
  return { calls, tools };
}

test("registers the break tool", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["insert_break"]);
});

test("insert_break forwards kind and position normalized", async () => {
  const { calls, tools } = harness();
  await tools.insert_break({ document_id: "d", kind: "section_next_page", index: 4 });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    kind: "section_next_page",
    index: 4,
    tabId: undefined,
    segmentId: undefined,
  });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "insertBreak" });
  const res = await tools.insert_break({ document_id: "d", kind: "page" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
