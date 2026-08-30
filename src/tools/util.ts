import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Schema factories, not shared consts: reusing one zod object across two fields
 * makes zod-to-json-schema dedupe them into a `$ref`, which some tool-schema
 * consumers (OpenAI Apps review) don't dereference and flag as `any`. A fresh
 * object per field keeps each one inlined with its type + pattern.
 */
export const documentIdSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      "The document id — the long id from the document URL (docs.google.com/document/d/<documentId>/edit) or from create_document output.",
    );

/**
 * An index into the document, counted in UTF-16 code units from the start of
 * the segment. Body content starts at index 1; headers/footers/footnotes start
 * at 0 in their own segment.
 */
export const indexSchema = () => z.number().int().min(0);

/** The id of a document tab (from list_tabs). Omitted = the first/only tab. */
export const tabIdSchema = () =>
  z.string().min(1).describe("Tab to target (from list_tabs). Omit for the first/only tab.");

/** A header/footer/footnote segment id; omitted = the tab's body. */
export const segmentIdSchema = () =>
  z
    .string()
    .min(1)
    .describe("Header/footer/footnote segment id (from get_document). Omit for the document body.");

/** A 6-digit hex color, with or without the leading #. */
export const hexColorSchema = () =>
  z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color like "#1a73e8"');

/** Wraps a value as a compact-JSON tool result (compact: the consumer is an LLM). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text", text: text ?? "null" }] };
}

export function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  // Surface the underlying cause (e.g. the network error behind a timeout) — no
  // secrets live in cause, and it makes failures far easier to diagnose.
  if (err instanceof Error && err.cause instanceof Error) message += ` (${err.cause.message})`;
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * MCP tool annotations — hints the consuming client can use to gate or label a
 * tool. All four hints are set explicitly on every tool: some clients (OpenAI
 * Apps review) require readOnlyHint, destructiveHint and openWorldHint on each.
 *
 * The Docs API mixes reads and writes, so each tool picks one of four presets:
 * READ_ONLY (pure reads), WRITE (creates new state; replaying duplicates it),
 * UPDATE (overwrites existing fields; replaying the same update converges) and
 * DESTRUCTIVE (removes existing state; replaying hits different targets).
 */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const UPDATE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
