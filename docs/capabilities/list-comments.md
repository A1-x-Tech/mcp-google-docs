# Google Docs: List comments — MCP tool

**Google Docs MCP tool:** Lists the document's comment threads with replies and resolution state.

Technical name: `list_comments`

## What task it solves

> I want to see a document's comments.

Lists the document's comment threads with replies and resolution state.

## When to use it

Use it to review feedback: each thread carries its content, author display name, timestamps, the quoted document text it anchors to, resolution state and all replies. Comment ids feed `manage_comment`.

## What to provide

- `document_id` — **required**.
- `page_size` — optional (default 20, max 100); `page_token` — optional continuation.
- `include_deleted` — optional. Also return deleted comments as tombstones.

## What it returns

`comments[]` with `id`, `content`, `author.displayName`, `createdTime`/`modifiedTime`, `resolved`, `quotedFileContent` and `replies[]` (with `action` resolve/reopen); `nextPageToken` for pagination.

## What changes in Google Docs

Nothing — the tool reads comment data and does not change it.

## Example request

> List the unresolved comments on the proposal and summarize what reviewers want changed.

## Errors and limitations

Comments are Drive data: the OAuth token needs a Drive scope, or every comment call fails with 403 while document reading still works. Author emails are not returned, only display names.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create, reply to, resolve or delete a comment](./manage-comment.md) — `manage_comment`
- [Get document structure](./get-document.md) — `get_document`

## Technical details

- **Impact:** read-only
- **Group:** Comments
- **Description source:** `list_comments` registration in `src/tools/comments.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
