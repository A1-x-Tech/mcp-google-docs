import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient } from "../client.js";
import {
  documentIdSchema,
  fail,
  indexSchema,
  ok,
  segmentIdSchema,
  tabIdSchema,
  UPDATE,
  WRITE,
} from "./util.js";

export function registerImageTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "insert_image",
    {
      title: "Insert an image",
      annotations: WRITE,
      description:
        "Inserts an inline image fetched from a PUBLIC URL at an index (or at the end of the body when index is omitted). The URL must be reachable by Google without auth, at most 50 MB and 25 megapixels, in PNG, JPEG or GIF; there is no upload channel — a local file must be hosted somewhere public first. width_pt/height_pt set the displayed size in points (omit both for natural size capped to the page width; when only one is given the API scales the other to keep the aspect ratio). Returns the created objectId in the reply — keep it for replace_image. Delete an image by deleting its range with delete_range (it occupies one index).",
      inputSchema: {
        document_id: documentIdSchema(),
        uri: z
          .string()
          .url()
          .describe("Public image URL (PNG/JPEG/GIF, <=50 MB, <=25 MP; fetched by Google, not this server)."),
        index: indexSchema()
          .optional()
          .describe("Insertion index (from read_document_text). Omit to append at the end."),
        width_pt: z.number().positive().optional().describe("Displayed width in points."),
        height_pt: z.number().positive().optional().describe("Displayed height in points."),
        tab_id: tabIdSchema().optional(),
        segment_id: segmentIdSchema().optional(),
      },
    },
    async ({ document_id, uri, index, width_pt, height_pt, tab_id, segment_id }) => {
      try {
        return ok(
          await client.insertImage({
            documentId: document_id,
            uri,
            index,
            widthPt: width_pt,
            heightPt: height_pt,
            tabId: tab_id,
            segmentId: segment_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "replace_image",
    {
      title: "Replace an image",
      annotations: UPDATE,
      description:
        "Replaces an existing image's contents with a new image from a public URL, keeping the original's size and position (the new image is center-cropped to fit). image_object_id is the inline object id — read_document_text shows it inside [image:<objectId>] placeholders, and get_document lists all ids under inlineObjects. The same URL rules as insert_image apply (public, <=50 MB, <=25 MP, PNG/JPEG/GIF).",
      inputSchema: {
        document_id: documentIdSchema(),
        image_object_id: z
          .string()
          .min(1)
          .describe("The image's object id (from read_document_text [image:...] or get_document inlineObjects)."),
        uri: z.string().url().describe("Public URL of the new image."),
        tab_id: tabIdSchema().optional(),
      },
    },
    async ({ document_id, image_object_id, uri, tab_id }) => {
      try {
        return ok(
          await client.replaceImage({
            documentId: document_id,
            imageObjectId: image_object_id,
            uri,
            tabId: tab_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
