# Google Docs: Create, reply to, resolve or delete a comment — MCP tool

**Google Docs MCP tool:** Creates comments, replies to threads, resolves/reopens them or deletes them.

Technical name: `manage_comment`

## What task it solves

> I want to work with a document's comment threads.

Creates comments, replies to threads, resolves/reopens them or deletes them.

## When to use it

Use it to leave feedback (`create`), answer a thread (`reply`), close a finished thread (`resolve` — the reversible way), reactivate one (`reopen`) or permanently remove one (`delete`). Get comment ids from `list_comments`.

## What to provide

- `document_id` — **required**; `action` — **required** (`create`/`reply`/`resolve`/`reopen`/`delete`).
- `content` — required for create/reply; optional closing text for resolve/reopen.
- `comment_id` — required for reply/resolve/reopen/delete.
- `quoted_text` — create only: the passage the comment refers to (shown as a quote).

## What it returns

The created/updated comment or reply resource; delete returns an empty result.

## What changes in Google Docs

create adds a document-level comment; reply/resolve/reopen append to the thread and flip its resolved state; delete PERMANENTLY removes the thread with all replies.

## Example request

> Resolve the comment about the pricing section with the note "fixed in the latest revision".

## Errors and limitations

New comments cannot be anchored to a live text range — the Drive anchor format for Docs is not public; quoted_text is a citation, not an anchor. delete is final; prefer resolve. Requires a Drive scope on the token.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List comments](./list-comments.md) — `list_comments`

## Technical details

- **Impact:** destructive operation
- **Group:** Comments
- **Description source:** `manage_comment` registration in `src/tools/comments.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
