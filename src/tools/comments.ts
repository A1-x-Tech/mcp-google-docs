import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleDocsClient } from "../client.js";
import { DESTRUCTIVE, documentIdSchema, fail, ok, READ_ONLY } from "./util.js";

export function registerCommentTools(server: McpServer, client: GoogleDocsClient): void {
  server.registerTool(
    "list_comments",
    {
      title: "List comments",
      annotations: READ_ONLY,
      description:
        "Lists the document's comment threads via the Drive API: for each comment its id, content, author displayName, createdTime/modifiedTime, resolved flag, the quoted document text it anchors to (quotedFileContent) and its replies (with their action: resolve/reopen). Paginate with page_token; include_deleted=true also returns deleted comments as tombstones. Requires a Drive scope on the OAuth token (comments are Drive data, not Docs API data). Comment ids feed manage_comment.",
      inputSchema: {
        document_id: documentIdSchema(),
        page_size: z.number().int().min(1).max(100).optional().describe("Comments per page (default 20, max 100)."),
        page_token: z.string().optional().describe("Continuation token from the previous page."),
        include_deleted: z.boolean().optional().describe("Also return deleted comments (default false)."),
      },
    },
    async ({ document_id, page_size, page_token, include_deleted }) => {
      try {
        return ok(
          await client.listComments({
            documentId: document_id,
            pageSize: page_size,
            pageToken: page_token,
            includeDeleted: include_deleted,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "manage_comment",
    {
      title: "Create, reply to, resolve or delete a comment",
      // One tool covers create/reply/resolve/reopen/delete; delete removes
      // state, so the whole tool carries the destructive, non-idempotent hints.
      annotations: DESTRUCTIVE,
      description:
        "Manages comment threads via the Drive API. action=create adds a NEW comment (needs content; optional quoted_text cites a passage — the API cannot anchor a new comment to a live range, that anchor format is not public, so it appears at document level). action=reply adds a reply (needs comment_id + content). action=resolve closes the thread (needs comment_id; optional content posts a closing reply); action=reopen reactivates it. action=delete PERMANENTLY removes the comment and all its replies (needs comment_id) — deleting is final, resolving is the reversible way to close a thread. Get comment_id from list_comments. Requires a Drive scope on the OAuth token.",
      inputSchema: {
        document_id: documentIdSchema(),
        action: z
          .enum(["create", "reply", "resolve", "reopen", "delete"])
          .describe("What to do with the document's comments."),
        comment_id: z
          .string()
          .min(1)
          .optional()
          .describe("reply/resolve/reopen/delete: the comment thread to target (from list_comments)."),
        content: z
          .string()
          .min(1)
          .optional()
          .describe("create/reply: the comment text (plain text). Optional closing text for resolve/reopen."),
        quoted_text: z
          .string()
          .min(1)
          .optional()
          .describe("create only: the passage of document text the comment refers to (shown as a quote)."),
      },
    },
    async ({ document_id, action, comment_id, content, quoted_text }) => {
      try {
        switch (action) {
          case "create":
            if (!content) return fail(new Error('action "create" requires content.'));
            return ok(
              await client.createComment({ documentId: document_id, content, quotedText: quoted_text }),
            );
          case "reply":
            if (!comment_id || !content) {
              return fail(new Error('action "reply" requires comment_id and content.'));
            }
            return ok(await client.replyComment({ documentId: document_id, commentId: comment_id, content }));
          case "resolve":
          case "reopen":
            if (!comment_id) return fail(new Error(`action "${action}" requires comment_id.`));
            return ok(
              await client.replyComment({
                documentId: document_id,
                commentId: comment_id,
                content,
                action,
              }),
            );
          case "delete":
            if (!comment_id) return fail(new Error('action "delete" requires comment_id.'));
            return ok(await client.deleteComment({ documentId: document_id, commentId: comment_id }));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
