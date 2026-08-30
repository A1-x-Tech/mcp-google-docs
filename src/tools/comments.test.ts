import { test } from "node:test";
import assert from "node:assert/strict";
import { registerCommentTools } from "./comments.js";

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
    listComments: make("listComments"),
    createComment: make("createComment"),
    replyComment: make("replyComment"),
    deleteComment: make("deleteComment"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerCommentTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two comment tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["list_comments", "manage_comment"]);
});

test("list_comments forwards pagination normalized", async () => {
  const { calls, tools } = harness();
  await tools.list_comments({ document_id: "d", page_size: 50, page_token: "tok", include_deleted: true });
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    pageSize: 50,
    pageToken: "tok",
    includeDeleted: true,
  });
});

test("manage_comment create/reply/resolve/reopen/delete map to the right client calls", async () => {
  const { calls, tools } = harness();
  await tools.manage_comment({ document_id: "d", action: "create", content: "Hi", quoted_text: "there" });
  assert.equal(calls[0].method, "createComment");
  assert.deepEqual(calls[0].params[0], { documentId: "d", content: "Hi", quotedText: "there" });

  await tools.manage_comment({ document_id: "d", action: "reply", comment_id: "c1", content: "Yes" });
  assert.equal(calls[1].method, "replyComment");
  assert.deepEqual(calls[1].params[0], { documentId: "d", commentId: "c1", content: "Yes" });

  await tools.manage_comment({ document_id: "d", action: "resolve", comment_id: "c1" });
  assert.deepEqual(calls[2].params[0], { documentId: "d", commentId: "c1", content: undefined, action: "resolve" });

  await tools.manage_comment({ document_id: "d", action: "reopen", comment_id: "c1", content: "Not done" });
  assert.deepEqual(calls[3].params[0], { documentId: "d", commentId: "c1", content: "Not done", action: "reopen" });

  await tools.manage_comment({ document_id: "d", action: "delete", comment_id: "c1" });
  assert.equal(calls[4].method, "deleteComment");
  assert.deepEqual(calls[4].params[0], { documentId: "d", commentId: "c1" });
});

test("manage_comment validates required params per action", async () => {
  const { calls, tools } = harness();
  for (const args of [
    { document_id: "d", action: "create" },
    { document_id: "d", action: "reply", comment_id: "c1" },
    { document_id: "d", action: "reply", content: "x" },
    { document_id: "d", action: "resolve" },
    { document_id: "d", action: "delete" },
  ]) {
    const res = await tools.manage_comment(args);
    assert.equal(res.isError, true, JSON.stringify(args));
  }
  assert.equal(calls.length, 0, "invalid inputs must not reach the client");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listComments" });
  const res = await tools.list_comments({ document_id: "d" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
