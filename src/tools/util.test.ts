import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTRUCTIVE,
  documentIdSchema,
  fail,
  hexColorSchema,
  indexSchema,
  ok,
  READ_ONLY,
  UPDATE,
  WRITE,
} from "./util.js";

test("hexColorSchema accepts 6-digit hex with or without # and rejects junk", () => {
  const c = hexColorSchema(); // factory → fresh schema
  assert.equal(c.safeParse("#1a73e8").success, true);
  assert.equal(c.safeParse("FFffFF").success, true);
  assert.equal(c.safeParse("#fff").success, false);
  assert.equal(c.safeParse("red").success, false);
});

test("indexSchema rejects negatives and fractions", () => {
  const i = indexSchema();
  assert.equal(i.safeParse(0).success, true);
  assert.equal(i.safeParse(42).success, true);
  assert.equal(i.safeParse(-1).success, false);
  assert.equal(i.safeParse(1.5).success, false);
});

test("schema factories return independent schemas (no $ref dedup)", () => {
  assert.notEqual(documentIdSchema(), documentIdSchema());
  assert.notEqual(hexColorSchema(), hexColorSchema());
});

test("ok emits compact JSON; fail flags isError", () => {
  assert.equal((ok({ a: 1 }).content[0] as { text: string }).text, '{"a":1}');
  const f = fail(new Error("boom"));
  assert.equal(f.isError, true);
  assert.match((f.content[0] as { text: string }).text, /boom/);
});

test("fail appends the underlying cause when present", () => {
  const err = new Error("timeout", { cause: new Error("ECONNRESET") });
  const f = fail(err);
  assert.match((f.content[0] as { text: string }).text, /timeout \(ECONNRESET\)/);
});

test("the four annotation presets set all four hints explicitly", () => {
  assert.deepEqual(READ_ONLY, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(WRITE, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(UPDATE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(DESTRUCTIVE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  });
});
