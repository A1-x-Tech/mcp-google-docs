import { test } from "node:test";
import assert from "node:assert/strict";
import { registerImageTools } from "./images.js";

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
    insertImage: make("insertImage"),
    replaceImage: make("replaceImage"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerImageTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two image tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["insert_image", "replace_image"]);
});

test("insert_image forwards uri, position and size normalized", async () => {
  const { calls, tools } = harness();
  await tools.insert_image({
    document_id: "d",
    uri: "https://img.example/a.png",
    index: 2,
    width_pt: 300,
    height_pt: 200,
  });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    uri: "https://img.example/a.png",
    index: 2,
    widthPt: 300,
    heightPt: 200,
    tabId: undefined,
    segmentId: undefined,
  });
});

test("replace_image forwards the object id and new uri", async () => {
  const { calls, tools } = harness();
  await tools.replace_image({
    document_id: "d",
    image_object_id: "kix.img1",
    uri: "https://img.example/b.png",
  });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    imageObjectId: "kix.img1",
    uri: "https://img.example/b.png",
    tabId: undefined,
  });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "insertImage" });
  const res = await tools.insert_image({ document_id: "d", uri: "https://img.example/a.png" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
