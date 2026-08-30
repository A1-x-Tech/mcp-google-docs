import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient } from "../client.js";
import {
  documentIdSchema,
  fail,
  hexColorSchema,
  indexSchema,
  ok,
  segmentIdSchema,
  tabIdSchema,
  UPDATE,
} from "./util.js";

export function registerStyleTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "style_text",
    {
      title: "Style a text range",
      annotations: UPDATE,
      description:
        "Applies character formatting to [start_index, end_index): bold, italic, underline, strikethrough, small_caps, font_size (points), font_family (e.g. \"Roboto\"), foreground_color/background_color (6-digit hex), link_url (empty string removes an existing link) and baseline_offset (superscript/subscript/none). Only the provided fields change (the fields mask is computed); at least one is required. Explicit false turns a toggle off. Get indexes from read_document_text. Styling does not shift indexes, so several style calls can safely reuse the same coordinates.",
      inputSchema: {
        document_id: documentIdSchema(),
        start_index: indexSchema().describe("Start of the range to style (inclusive)."),
        end_index: indexSchema().describe("End of the range to style (exclusive)."),
        bold: z.boolean().optional().describe("Bold on/off."),
        italic: z.boolean().optional().describe("Italic on/off."),
        underline: z.boolean().optional().describe("Underline on/off."),
        strikethrough: z.boolean().optional().describe("Strikethrough on/off."),
        small_caps: z.boolean().optional().describe("Small caps on/off."),
        font_size: z.number().positive().optional().describe("Font size in points."),
        font_family: z.string().min(1).optional().describe('Font family name, e.g. "Roboto".'),
        foreground_color: hexColorSchema().optional().describe('Text color, e.g. "#1a73e8".'),
        background_color: hexColorSchema().optional().describe('Text highlight color, e.g. "#ffff00".'),
        link_url: z
          .string()
          .optional()
          .describe("Turn the range into a link to this URL; empty string removes an existing link."),
        baseline_offset: z
          .enum(["none", "superscript", "subscript"])
          .optional()
          .describe("Vertical offset of the text."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.updateTextStyle({
            documentId: args.document_id,
            startIndex: args.start_index,
            endIndex: args.end_index,
            tabId: args.tab_id,
            segmentId: args.segment_id,
            bold: args.bold,
            italic: args.italic,
            underline: args.underline,
            strikethrough: args.strikethrough,
            smallCaps: args.small_caps,
            fontSize: args.font_size,
            fontFamily: args.font_family,
            foregroundColor: args.foreground_color,
            backgroundColor: args.background_color,
            linkUrl: args.link_url,
            baselineOffset: args.baseline_offset,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "style_paragraph",
    {
      title: "Style paragraphs",
      annotations: UPDATE,
      description:
        "Applies paragraph formatting to every paragraph overlapping [start_index, end_index): named_style (normal_text, title, subtitle, heading_1..heading_6 — the way to make headings), alignment (start/center/end/justified), line_spacing (100 = single, 200 = double), space_above/space_below (points), indent_start/indent_end/indent_first_line (points), keep_with_next and direction (ltr/rtl). Only the provided fields change; at least one is required. A range inside a single paragraph styles that whole paragraph.",
      inputSchema: {
        document_id: documentIdSchema(),
        start_index: indexSchema().describe("Start of the paragraph range (inclusive)."),
        end_index: indexSchema().describe("End of the paragraph range (exclusive)."),
        named_style: z
          .enum([
            "normal_text",
            "title",
            "subtitle",
            "heading_1",
            "heading_2",
            "heading_3",
            "heading_4",
            "heading_5",
            "heading_6",
          ])
          .optional()
          .describe("Named paragraph style — headings feed the document outline."),
        alignment: z.enum(["start", "center", "end", "justified"]).optional().describe("Text alignment."),
        line_spacing: z.number().positive().optional().describe("100 = single spacing, 200 = double."),
        space_above: z.number().min(0).optional().describe("Extra space above the paragraph, points."),
        space_below: z.number().min(0).optional().describe("Extra space below the paragraph, points."),
        indent_start: z.number().min(0).optional().describe("Indent from the start edge, points."),
        indent_end: z.number().min(0).optional().describe("Indent from the end edge, points."),
        indent_first_line: z.number().min(0).optional().describe("First-line indent, points."),
        keep_with_next: z.boolean().optional().describe("Keep on the same page as the next paragraph."),
        direction: z.enum(["ltr", "rtl"]).optional().describe("Content direction."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.updateParagraphStyle({
            documentId: args.document_id,
            startIndex: args.start_index,
            endIndex: args.end_index,
            tabId: args.tab_id,
            segmentId: args.segment_id,
            namedStyle: args.named_style,
            alignment: args.alignment,
            lineSpacing: args.line_spacing,
            spaceAbove: args.space_above,
            spaceBelow: args.space_below,
            indentStart: args.indent_start,
            indentEnd: args.indent_end,
            indentFirstLine: args.indent_first_line,
            keepWithNext: args.keep_with_next,
            direction: args.direction,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "set_paragraph_bullets",
    {
      title: "Set or remove list bullets",
      annotations: UPDATE,
      description:
        "Turns the paragraphs overlapping [start_index, end_index) into a list, or removes their bullets with remove=true. Presets: disc, arrow, checkbox, star, diamond (bulleted); decimal, decimal_parens, decimal_nested, upper_alpha, upper_roman, zero_decimal (numbered). Nesting follows each paragraph's leading tabs — indent with \\t in insert_text before applying bullets to create sub-items. Exactly one of preset or remove is required.",
      inputSchema: {
        document_id: documentIdSchema(),
        start_index: indexSchema().describe("Start of the paragraph range (inclusive)."),
        end_index: indexSchema().describe("End of the paragraph range (exclusive)."),
        preset: z
          .enum([
            "disc",
            "arrow",
            "checkbox",
            "star",
            "diamond",
            "decimal",
            "decimal_parens",
            "decimal_nested",
            "upper_alpha",
            "upper_roman",
            "zero_decimal",
          ])
          .optional()
          .describe("The bullet/numbering style to apply."),
        remove: z.boolean().optional().describe("true removes existing bullets instead of applying a preset."),
        tab_id: tabIdSchema().optional(),
      },
    },
    async ({ document_id, start_index, end_index, preset, remove, tab_id }) => {
      try {
        if (remove) {
          if (preset) return fail(new Error("Provide either preset or remove=true, not both."));
          return ok(
            await client.deleteParagraphBullets({
              documentId: document_id,
              startIndex: start_index,
              endIndex: end_index,
              tabId: tab_id,
            }),
          );
        }
        if (!preset) return fail(new Error("Provide preset to apply bullets, or remove=true to strip them."));
        return ok(
          await client.createParagraphBullets({
            documentId: document_id,
            startIndex: start_index,
            endIndex: end_index,
            preset,
            tabId: tab_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
