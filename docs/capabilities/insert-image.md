# Google Docs: Insert an image — MCP tool

**Google Docs MCP tool:** Inserts an inline image fetched by Google from a public URL.

Technical name: `insert_image`

## What task it solves

> I want to add an image to a document.

Inserts an inline image fetched by Google from a public URL.

## When to use it

Use it to place an inline image at a position (or append it). Google fetches the URL itself — the image must be publicly reachable; a local file must be hosted somewhere public first (there is no upload channel in the Docs API).

## What to provide

- `document_id` — **required**.
- `uri` — **required**. Public PNG/JPEG/GIF URL, at most 50 MB and 25 megapixels.
- `index` — optional insertion point; omit to append.
- `width_pt` / `height_pt` — optional display size in points.
- `tab_id`, `segment_id` — optional addressing.

## What it returns

The batchUpdate reply including the created image `objectId` — keep it for `replace_image`.

## What changes in Google Docs

An inline image appears at the position, occupying one index. Later indexes shift by one.

## Example request

> Insert the architecture diagram from this URL under the Design heading.

## Errors and limitations

Unreachable/private URLs and unsupported formats are rejected by Google. Delete an image by deleting its one-index range with delete_range; positioned (floating) objects need raw_request.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Replace an image](./replace-image.md) — `replace_image`
- [Delete a text range](./delete-range.md) — `delete_range`

## Technical details

- **Impact:** changes data
- **Group:** Images
- **Description source:** `insert_image` registration in `src/tools/images.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
