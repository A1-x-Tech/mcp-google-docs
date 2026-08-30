# Google Docs: Replace an image — MCP tool

**Google Docs MCP tool:** Swaps an existing image's contents for a new one, keeping size and position.

Technical name: `replace_image`

## What task it solves

> I want to swap an image for a new version.

Swaps an existing image's contents for a new one, keeping size and position.

## When to use it

Use it to refresh a diagram or screenshot without touching layout: the new image is center-cropped into the original's frame. Find the object id in `read_document_text` (`[image:<objectId>]`) or `get_document` (`inlineObjects`).

## What to provide

- `document_id` — **required**.
- `image_object_id` — **required**. The existing image's object id.
- `uri` — **required**. Public URL of the new image (same rules as insert_image).
- `tab_id` — optional.

## What it returns

The batchUpdate reply with the new `revisionId`.

## What changes in Google Docs

The image's pixels change; its size, position and text flow stay. The old image content is gone from the document (it remains in version history in the UI).

## Example request

> Replace the outdated org chart image with the new one at this URL.

## Errors and limitations

The object id must belong to an image in this document. The same URL restrictions as insert_image apply (public, <=50 MB, <=25 MP, PNG/JPEG/GIF).

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert an image](./insert-image.md) — `insert_image`
- [Get document structure](./get-document.md) — `get_document`

## Technical details

- **Impact:** destructive operation
- **Group:** Images
- **Description source:** `replace_image` registration in `src/tools/images.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
