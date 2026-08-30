import { test } from "node:test";
import assert from "node:assert/strict";
import { registerStyleTools } from "./styles.js";

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
    updateTextStyle: make("updateTextStyle"),
    updateParagraphStyle: make("updateParagraphStyle"),
    createParagraphBullets: make("createParagraphBullets"),
    deleteParagraphBullets: make("deleteParagraphBullets"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerStyleTools(server as never, client as never);
  return { calls, tools };
}

test("registers the three style tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["set_paragraph_bullets", "style_paragraph", "style_text"]);
});

test("style_text forwards every provided style field normalized", async () => {
  const { calls, tools } = harness();
  await tools.style_text({
    document_id: "d",
    start_index: 1,
    end_index: 5,
    bold: true,
    small_caps: false,
    font_size: 12,
    font_family: "Roboto",
    foreground_color: "#112233",
    link_url: "",
    baseline_offset: "superscript",
  });
  assert.equal(calls[0].method, "updateTextStyle");
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.documentId, "d");
  assert.equal(params.startIndex, 1);
  assert.equal(params.endIndex, 5);
  assert.equal(params.bold, true);
  assert.equal(params.smallCaps, false);
  assert.equal(params.fontSize, 12);
  assert.equal(params.fontFamily, "Roboto");
  assert.equal(params.foregroundColor, "#112233");
  assert.equal(params.linkUrl, "");
  assert.equal(params.baselineOffset, "superscript");
});

test("style_paragraph forwards named style and spacing normalized", async () => {
  const { calls, tools } = harness();
  await tools.style_paragraph({
    document_id: "d",
    start_index: 1,
    end_index: 20,
    named_style: "heading_2",
    alignment: "center",
    line_spacing: 150,
    keep_with_next: true,
  });
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.namedStyle, "heading_2");
  assert.equal(params.alignment, "center");
  assert.equal(params.lineSpacing, 150);
  assert.equal(params.keepWithNext, true);
});

test("set_paragraph_bullets applies a preset or removes bullets", async () => {
  const { calls, tools } = harness();
  await tools.set_paragraph_bullets({ document_id: "d", start_index: 1, end_index: 30, preset: "disc" });
  assert.equal(calls[0].method, "createParagraphBullets");
  assert.deepEqual(calls[0].params[0], {
    documentId: "d",
    startIndex: 1,
    endIndex: 30,
    preset: "disc",
    tabId: undefined,
  });

  await tools.set_paragraph_bullets({ document_id: "d", start_index: 1, end_index: 30, remove: true });
  assert.equal(calls[1].method, "deleteParagraphBullets");
});

test("set_paragraph_bullets rejects preset+remove together and neither", async () => {
  const { calls, tools } = harness();
  const both = await tools.set_paragraph_bullets({
    document_id: "d",
    start_index: 1,
    end_index: 2,
    preset: "disc",
    remove: true,
  });
  assert.equal(both.isError, true);
  const neither = await tools.set_paragraph_bullets({ document_id: "d", start_index: 1, end_index: 2 });
  assert.equal(neither.isError, true);
  assert.equal(calls.length, 0, "invalid combinations must not reach the client");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "updateTextStyle" });
  const res = await tools.style_text({ document_id: "d", start_index: 1, end_index: 2, bold: true });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
