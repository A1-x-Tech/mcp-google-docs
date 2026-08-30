import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDocumentTools } from "./documents.js";
import { registerTextTools } from "./text.js";
import { registerStyleTools } from "./styles.js";
import { registerTableTools } from "./tables.js";
import { registerStructureTools } from "./structure.js";
import { registerImageTools } from "./images.js";
import { registerCommentTools } from "./comments.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, UPDATE, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerDocumentTools(server as never, {} as never);
  registerTextTools(server as never, {} as never);
  registerStyleTools(server as never, {} as never);
  registerTableTools(server as never, {} as never);
  registerStructureTools(server as never, {} as never);
  registerImageTools(server as never, {} as never);
  registerCommentTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The Docs API mixes reads and writes, so instead of one blanket invariant the
 * expected hints are pinned per tool. Changing a tool's annotation must be a
 * conscious decision that updates this map.
 */
const EXPECTED: Record<string, Annotations> = {
  create_document: WRITE,
  get_document: READ_ONLY,
  read_document_text: READ_ONLY,
  list_tabs: READ_ONLY,
  // WRITE, not READ_ONLY: with output_path the tool creates a local file, and
  // readOnlyHint must mean "does not modify its environment" for every mode.
  export_document: WRITE,
  import_markdown: UPDATE,
  insert_text: WRITE,
  replace_range: DESTRUCTIVE,
  replace_all_text: UPDATE,
  delete_range: DESTRUCTIVE,
  style_text: UPDATE,
  style_paragraph: UPDATE,
  set_paragraph_bullets: UPDATE,
  insert_table: WRITE,
  edit_table: DESTRUCTIVE,
  insert_break: WRITE,
  insert_image: WRITE,
  replace_image: UPDATE,
  list_comments: READ_ONLY,
  manage_comment: DESTRUCTIVE,
  raw_request: DESTRUCTIVE,
};

test("registers all twenty-one tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("reads stay read-only — none of them may mutate the document", () => {
  // export_document is deliberately absent: with output_path it writes a local
  // file, so it must not carry readOnlyHint even though Docs data never changes.
  for (const name of ["get_document", "read_document_text", "list_tabs", "list_comments"]) {
    assert.equal(ANN[name]?.readOnlyHint, true, `${name} must be read-only`);
  }
  assert.equal(ANN.export_document?.readOnlyHint, false, "export_document can write a local file");
});

test("content-removing tools are flagged destructive", () => {
  for (const name of ["delete_range", "replace_range", "edit_table", "import_markdown", "manage_comment"]) {
    assert.equal(ANN[name]?.destructiveHint, true, `${name} must carry destructiveHint`);
  }
});
