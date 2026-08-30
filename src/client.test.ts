import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildParagraphStyle,
  buildTextStyle,
  extractBlocks,
  extractDocumentText,
  extractTabTree,
  GoogleDocsClient,
  hexToRgbColor,
  mapBulletPreset,
} from "./client.js";
import { CredentialsError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleDocsConfig } from "./types.js";

const BASE = "https://docs.googleapis.com";
const DRIVE = "https://www.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Call = { url: string; method: string; auth: unknown; contentType: unknown; body: string | undefined };

/** A client on a static access token — no token-endpoint traffic expected. */
function staticConfig(extra: Partial<GoogleDocsConfig> = {}): GoogleDocsConfig {
  return { accessToken: "STATIC", apiBase: BASE, driveApiBase: DRIVE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** A client on the refresh flow. */
function refreshConfig(extra: Partial<GoogleDocsConfig> = {}): GoogleDocsConfig {
  return {
    clientId: "cid",
    clientSecret: "csec",
    refreshToken: "rtok",
    apiBase: BASE,
    driveApiBase: DRIVE,
    maxRetries: 0,
    retryBaseMs: 0,
    ...extra,
  };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({
      url: String(url),
      method: String(i.method),
      auth: i.headers?.Authorization,
      contentType: i.headers?.["Content-Type"],
      body: typeof i.body === "string" ? i.body : undefined,
    });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** Default handler: token endpoint mints TOK-1, everything else returns { ok: true }. */
function defaultHandler(url: string): Response {
  if (url === TOKEN_URL) return okJson({ access_token: "TOK-1", expires_in: 3600 });
  return okJson({ ok: true });
}

/** The batchUpdate body of the nth recorded call, parsed. */
function batchBody(calls: Call[], n = 0): { requests: Record<string, unknown>[] } {
  return JSON.parse(calls[n].body!) as { requests: Record<string, unknown>[] };
}

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * and the forced 401 re-mint alike (maxRetries is deliberately non-zero here).
 */
test("no credentials at all: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient({ apiBase: BASE, driveApiBase: DRIVE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.getDocument({ documentId: "abc" }),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        // The historical startup error, verbatim — the message is the product.
        assert.ok(
          err.message.startsWith(
            "Google OAuth credentials are required: set GOOGLE_DOCS_CLIENT_ID + " +
              "GOOGLE_DOCS_CLIENT_SECRET + GOOGLE_DOCS_REFRESH_TOKEN (recommended), " +
              "or GOOGLE_DOCS_ACCESS_TOKEN with a short-lived access token.",
          ),
          "the message must open with the historical startup error, verbatim",
        );
        assert.match(err.message, /restart the server/, "the fix must mention the restart");
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no token mint, no replay");
  } finally {
    mock.restore();
  }
});

test("static access token: Bearer header, no token-endpoint traffic", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).getDocument({ documentId: "abc" });
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, `${BASE}/v1/documents/abc`);
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("refresh flow: mints a token first, then caches it across requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(refreshConfig());
    await client.getDocument({ documentId: "abc" });
    await client.getDocument({ documentId: "def" });

    const tokenCalls = mock.calls.filter((c) => c.url === TOKEN_URL);
    assert.equal(tokenCalls.length, 1, "the second request must reuse the cached token");
    assert.equal(tokenCalls[0].method, "POST");
    const params = new URLSearchParams(tokenCalls[0].body);
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("client_id"), "cid");
    assert.equal(params.get("client_secret"), "csec");
    assert.equal(params.get("refresh_token"), "rtok");

    const apiCalls = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) assert.equal(call.auth, "Bearer TOK-1");
  } finally {
    mock.restore();
  }
});

test("a 401 forces one re-mint and replays the request", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleDocsClient(refreshConfig()).getDocument({ documentId: "abc" });
    assert.deepEqual(result, { ok: true });
    assert.equal(minted, 2, "the 401 must force a second mint");
    const lastApi = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`)).at(-1);
    assert.equal(lastApi?.auth, "Bearer TOK-2");
  } finally {
    mock.restore();
  }
});

test("a persistent 401 throws instead of looping", async () => {
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) return okJson({ access_token: "TOK", expires_in: 3600 });
    apiHits++;
    return new Response('{"error":{"message":"nope","status":"UNAUTHENTICATED"}}', { status: 401 });
  });
  try {
    await assert.rejects(
      () => new GoogleDocsClient(refreshConfig()).getDocument({ documentId: "abc" }),
      /HTTP 401: \[UNAUTHENTICATED\] nope/,
    );
    assert.equal(apiHits, 2, "exactly one replay after the forced re-mint");
  } finally {
    mock.restore();
  }
});

test("a failed token exchange surfaces the OAuth error", async () => {
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      return new Response('{"error":"invalid_grant","error_description":"Token has been revoked."}', {
        status: 400,
      });
    }
    return okJson({ ok: true });
  });
  try {
    await assert.rejects(
      () => new GoogleDocsClient(refreshConfig()).getDocument({ documentId: "abc" }),
      /HTTP 400: invalid_grant: Token has been revoked\./,
    );
  } finally {
    mock.restore();
  }
});

// ---- Documents / Markdown / export mapping ----

test("createDocument posts only the title to documents.create", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).createDocument("Report");
    assert.equal(mock.calls[0].url, `${BASE}/v1/documents`);
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { title: "Report" });
  } finally {
    mock.restore();
  }
});

test("createDocumentFromMarkdown uploads multipart with Docs conversion", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).createDocumentFromMarkdown({
      title: "Report",
      markdown: "# Hello\n\nWorld",
    });
    const call = mock.calls[0];
    const url = new URL(call.url);
    assert.equal(url.origin, DRIVE);
    assert.equal(url.pathname, "/upload/drive/v3/files");
    assert.equal(url.searchParams.get("uploadType"), "multipart");
    assert.equal(call.method, "POST");
    assert.match(String(call.contentType), /^multipart\/related; boundary=/);
    assert.match(call.body!, /"mimeType":"application\/vnd\.google-apps\.document"/);
    assert.match(call.body!, /"name":"Report"/);
    assert.match(call.body!, /# Hello/);
    assert.equal(call.auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("getDocument builds the includeTabsContent / suggestionsViewMode query", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).getDocument({
      documentId: "d1",
      includeTabsContent: true,
      suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/documents/d1");
    assert.equal(url.searchParams.get("includeTabsContent"), "true");
    assert.equal(url.searchParams.get("suggestionsViewMode"), "PREVIEW_WITHOUT_SUGGESTIONS");
  } finally {
    mock.restore();
  }
});

test("exportDocument GETs the Drive export endpoint and returns raw bytes", async () => {
  const mock = mockFetch(() => new Response("# md", { status: 200 }));
  try {
    const bytes = await new GoogleDocsClient(staticConfig()).exportDocument({
      documentId: "d1",
      format: "markdown",
    });
    assert.equal(new TextDecoder().decode(bytes), "# md");
    const url = new URL(mock.calls[0].url);
    assert.equal(url.origin, DRIVE);
    assert.equal(url.pathname, "/drive/v3/files/d1/export");
    assert.equal(url.searchParams.get("mimeType"), "text/markdown");
    assert.equal(mock.calls[0].method, "GET");
  } finally {
    mock.restore();
  }
});

test("importMarkdown PATCHes a media upload with text/markdown content", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).importMarkdown({ documentId: "d1", markdown: "# New" });
    const call = mock.calls[0];
    const url = new URL(call.url);
    assert.equal(url.origin, DRIVE);
    assert.equal(url.pathname, "/upload/drive/v3/files/d1");
    assert.equal(url.searchParams.get("uploadType"), "media");
    assert.equal(call.method, "PATCH");
    assert.equal(call.contentType, "text/markdown; charset=UTF-8");
    assert.equal(call.body, "# New");
  } finally {
    mock.restore();
  }
});

// ---- Text mutations ----

test("insertText with an index sends a located insertText", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).insertText({
      documentId: "d1",
      text: "hi",
      index: 5,
      tabId: "t.0",
    });
    assert.equal(mock.calls[0].url, `${BASE}/v1/documents/d1:batchUpdate`);
    assert.deepEqual(batchBody(mock.calls).requests, [
      { insertText: { text: "hi", location: { index: 5, tabId: "t.0" } } },
    ]);
  } finally {
    mock.restore();
  }
});

test("insertText without an index appends at the end of the segment", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).insertText({ documentId: "d1", text: "hi" });
    assert.deepEqual(batchBody(mock.calls).requests, [
      { insertText: { text: "hi", endOfSegmentLocation: {} } },
    ]);
  } finally {
    mock.restore();
  }
});

test("deleteRange and replaceRange build ordered batchUpdate requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(staticConfig());
    await client.deleteRange({ documentId: "d1", startIndex: 3, endIndex: 9 });
    assert.deepEqual(batchBody(mock.calls, 0).requests, [
      { deleteContentRange: { range: { startIndex: 3, endIndex: 9 } } },
    ]);

    await client.replaceRange({ documentId: "d1", startIndex: 3, endIndex: 9, text: "new" });
    assert.deepEqual(batchBody(mock.calls, 1).requests, [
      { deleteContentRange: { range: { startIndex: 3, endIndex: 9 } } },
      { insertText: { text: "new", location: { index: 3 } } },
    ]);

    // Empty replacement degrades to a plain delete — no zero-length insert.
    await client.replaceRange({ documentId: "d1", startIndex: 3, endIndex: 9, text: "" });
    assert.equal(batchBody(mock.calls, 2).requests.length, 1);
  } finally {
    mock.restore();
  }
});

test("replaceAllText defaults matchCase to true and scopes to tabs", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).replaceAllText({
      documentId: "d1",
      find: "old",
      replace: "new",
      tabIds: ["t.0", "t.1"],
    });
    assert.deepEqual(batchBody(mock.calls).requests, [
      {
        replaceAllText: {
          containsText: { text: "old", matchCase: true },
          replaceText: "new",
          tabsCriteria: { tabIds: ["t.0", "t.1"] },
        },
      },
    ]);
  } finally {
    mock.restore();
  }
});

// ---- Styles ----

test("updateTextStyle computes the fields mask and maps colors/fonts", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).updateTextStyle({
      documentId: "d1",
      startIndex: 1,
      endIndex: 5,
      bold: true,
      fontSize: 14,
      fontFamily: "Roboto",
      foregroundColor: "#ff0000",
      linkUrl: "https://example.com",
    });
    const [request] = batchBody(mock.calls).requests;
    assert.deepEqual(request.updateTextStyle, {
      textStyle: {
        bold: true,
        fontSize: { magnitude: 14, unit: "PT" },
        weightedFontFamily: { fontFamily: "Roboto" },
        foregroundColor: { color: { rgbColor: { red: 1, green: 0, blue: 0 } } },
        link: { url: "https://example.com" },
      },
      fields: "bold,fontSize,weightedFontFamily,foregroundColor,link",
      range: { startIndex: 1, endIndex: 5 },
    });
  } finally {
    mock.restore();
  }
});

test("buildTextStyle clears a link on empty string and rejects empty input", () => {
  const cleared = buildTextStyle({ documentId: "d", startIndex: 1, endIndex: 2, linkUrl: "" });
  assert.equal(cleared.fields, "link");
  assert.deepEqual(cleared.textStyle, {});
  assert.throws(() => buildTextStyle({ documentId: "d", startIndex: 1, endIndex: 2 }), /At least one/);
});

test("updateParagraphStyle maps named styles, alignment and dimensions", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).updateParagraphStyle({
      documentId: "d1",
      startIndex: 1,
      endIndex: 20,
      namedStyle: "heading_2",
      alignment: "center",
      spaceAbove: 12,
      direction: "rtl",
    });
    const [request] = batchBody(mock.calls).requests;
    assert.deepEqual(request.updateParagraphStyle, {
      paragraphStyle: {
        namedStyleType: "HEADING_2",
        alignment: "CENTER",
        spaceAbove: { magnitude: 12, unit: "PT" },
        direction: "RIGHT_TO_LEFT",
      },
      fields: "namedStyleType,alignment,spaceAbove,direction",
      range: { startIndex: 1, endIndex: 20 },
    });
  } finally {
    mock.restore();
  }
});

test("buildParagraphStyle rejects a call without any style field", () => {
  assert.throws(() => buildParagraphStyle({ documentId: "d", startIndex: 1, endIndex: 2 }), /At least one/);
});

test("hexToRgbColor parses hex and rejects junk", () => {
  assert.deepEqual(hexToRgbColor("#000000"), { red: 0, green: 0, blue: 0 });
  assert.deepEqual(hexToRgbColor("ffffff"), { red: 1, green: 1, blue: 1 });
  assert.throws(() => hexToRgbColor("#12345"), /Invalid color/);
  assert.throws(() => hexToRgbColor("red"), /Invalid color/);
});

test("bullet presets map to wire values and both bullet calls hit batchUpdate", async () => {
  assert.equal(mapBulletPreset("disc"), "BULLET_DISC_CIRCLE_SQUARE");
  assert.equal(mapBulletPreset("checkbox"), "BULLET_CHECKBOX");
  assert.equal(mapBulletPreset("decimal"), "NUMBERED_DECIMAL_ALPHA_ROMAN");

  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(staticConfig());
    await client.createParagraphBullets({ documentId: "d1", startIndex: 1, endIndex: 30, preset: "disc" });
    assert.deepEqual(batchBody(mock.calls, 0).requests, [
      {
        createParagraphBullets: {
          range: { startIndex: 1, endIndex: 30 },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      },
    ]);
    await client.deleteParagraphBullets({ documentId: "d1", startIndex: 1, endIndex: 30 });
    assert.deepEqual(batchBody(mock.calls, 1).requests, [
      { deleteParagraphBullets: { range: { startIndex: 1, endIndex: 30 } } },
    ]);
  } finally {
    mock.restore();
  }
});

// ---- Tables, breaks, images ----

test("insertTable and editTable build the right requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(staticConfig());
    await client.insertTable({ documentId: "d1", rows: 2, columns: 3, index: 7 });
    assert.deepEqual(batchBody(mock.calls, 0).requests, [
      { insertTable: { rows: 2, columns: 3, location: { index: 7 } } },
    ]);

    await client.editTable({ documentId: "d1", action: "insert_row", tableStartIndex: 7, rowIndex: 1 });
    assert.deepEqual(batchBody(mock.calls, 1).requests, [
      {
        insertTableRow: {
          tableCellLocation: { tableStartLocation: { index: 7 }, rowIndex: 1, columnIndex: 0 },
          insertBelow: true,
        },
      },
    ]);

    await client.editTable({ documentId: "d1", action: "delete_column", tableStartIndex: 7, columnIndex: 2 });
    assert.deepEqual(batchBody(mock.calls, 2).requests, [
      {
        deleteTableColumn: {
          tableCellLocation: { tableStartLocation: { index: 7 }, rowIndex: 0, columnIndex: 2 },
        },
      },
    ]);
  } finally {
    mock.restore();
  }
});

test("insertBreak maps page and section kinds", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(staticConfig());
    await client.insertBreak({ documentId: "d1", kind: "page", index: 4 });
    assert.deepEqual(batchBody(mock.calls, 0).requests, [{ insertPageBreak: { location: { index: 4 } } }]);

    await client.insertBreak({ documentId: "d1", kind: "section_continuous" });
    assert.deepEqual(batchBody(mock.calls, 1).requests, [
      { insertSectionBreak: { sectionType: "CONTINUOUS", endOfSegmentLocation: {} } },
    ]);
  } finally {
    mock.restore();
  }
});

test("insertImage and replaceImage build the right requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(staticConfig());
    await client.insertImage({
      documentId: "d1",
      uri: "https://img.example/pic.png",
      index: 2,
      widthPt: 300,
      heightPt: 200,
    });
    assert.deepEqual(batchBody(mock.calls, 0).requests, [
      {
        insertInlineImage: {
          uri: "https://img.example/pic.png",
          objectSize: {
            width: { magnitude: 300, unit: "PT" },
            height: { magnitude: 200, unit: "PT" },
          },
          location: { index: 2 },
        },
      },
    ]);

    await client.replaceImage({ documentId: "d1", imageObjectId: "kix.img1", uri: "https://img.example/new.png" });
    assert.deepEqual(batchBody(mock.calls, 1).requests, [
      {
        replaceImage: {
          imageObjectId: "kix.img1",
          uri: "https://img.example/new.png",
          imageReplaceMethod: "CENTER_CROP",
        },
      },
    ]);
  } finally {
    mock.restore();
  }
});

// ---- Comments (Drive) ----

test("comment methods map to the Drive comments endpoints with explicit fields", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleDocsClient(staticConfig());
    await client.listComments({ documentId: "d1", pageSize: 50, includeDeleted: true });
    const listUrl = new URL(mock.calls[0].url);
    assert.equal(listUrl.origin, DRIVE);
    assert.equal(listUrl.pathname, "/drive/v3/files/d1/comments");
    assert.match(String(listUrl.searchParams.get("fields")), /^comments\(/);
    assert.equal(listUrl.searchParams.get("pageSize"), "50");
    assert.equal(listUrl.searchParams.get("includeDeleted"), "true");

    await client.createComment({ documentId: "d1", content: "Looks off", quotedText: "the phrase" });
    assert.equal(mock.calls[1].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[1].body!), {
      content: "Looks off",
      quotedFileContent: { value: "the phrase" },
    });

    await client.replyComment({ documentId: "d1", commentId: "c-1", action: "resolve" });
    assert.equal(new URL(mock.calls[2].url).pathname, "/drive/v3/files/d1/comments/c-1/replies");
    assert.deepEqual(JSON.parse(mock.calls[2].body!), { action: "resolve" });

    await client.deleteComment({ documentId: "d1", commentId: "c-1" });
    assert.equal(mock.calls[3].method, "DELETE");
    assert.equal(new URL(mock.calls[3].url).pathname, "/drive/v3/files/d1/comments/c-1");
  } finally {
    mock.restore();
  }
});

test("deleteFile targets the Drive file (smoke cleanup only)", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleDocsClient(staticConfig()).deleteFile("d1");
    assert.equal(mock.calls[0].method, "DELETE");
    assert.equal(new URL(mock.calls[0].url).pathname, "/drive/v3/files/d1");
  } finally {
    mock.restore();
  }
});

// ---- Text extraction ----

const SAMPLE_CONTENT = [
  {
    startIndex: 1,
    endIndex: 8,
    paragraph: {
      elements: [{ textRun: { content: "Title\n" } }],
      paragraphStyle: { namedStyleType: "HEADING_1" },
    },
  },
  {
    startIndex: 8,
    endIndex: 30,
    paragraph: {
      elements: [
        { textRun: { content: "Hello " } },
        { inlineObjectElement: { inlineObjectId: "kix.img1" } },
        { textRun: { content: " world\n" } },
      ],
      paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
      bullet: { listId: "kix.list1" },
    },
  },
  {
    startIndex: 30,
    endIndex: 60,
    table: {
      rows: 1,
      columns: 2,
      tableRows: [
        {
          tableCells: [
            { content: [{ paragraph: { elements: [{ textRun: { content: "A\n" } }] } }] },
            { content: [{ paragraph: { elements: [{ textRun: { content: "B\n" } }] } }] },
          ],
        },
      ],
    },
  },
];

test("extractBlocks flattens paragraphs, styles, bullets, images and tables", () => {
  const blocks = extractBlocks(SAMPLE_CONTENT as never);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], { start: 1, end: 8, type: "paragraph", text: "Title", style: "HEADING_1" });
  assert.equal(blocks[1].text, "Hello [image:kix.img1] world");
  assert.equal(blocks[1].bullet, true);
  assert.equal(blocks[1].style, undefined, "NORMAL_TEXT is the default and must be omitted");
  assert.deepEqual(blocks[2], {
    start: 30,
    end: 60,
    type: "table",
    rows: 1,
    columns: 2,
    cells: [["A", "B"]],
  });
});

const SAMPLE_DOC = {
  documentId: "d1",
  title: "Doc",
  tabs: [
    {
      tabProperties: { tabId: "t.0", title: "First", index: 0 },
      documentTab: { body: { content: SAMPLE_CONTENT } },
      childTabs: [
        {
          tabProperties: { tabId: "t.1", title: "Child", index: 1, nestingLevel: 1 },
          documentTab: {
            body: { content: [{ startIndex: 1, endIndex: 3, paragraph: { elements: [{ textRun: { content: "x\n" } }] } }] },
          },
        },
      ],
    },
  ],
};

test("extractDocumentText returns every tab, or one tab by id, and rejects unknown tabs", () => {
  const all = extractDocumentText(SAMPLE_DOC as never);
  assert.equal(all.tabs.length, 2, "child tabs are included");
  assert.equal(all.tabs[0].tabId, "t.0");
  assert.equal(all.tabs[1].tabId, "t.1");

  const one = extractDocumentText(SAMPLE_DOC as never, "t.1");
  assert.equal(one.tabs.length, 1);
  assert.equal(one.tabs[0].blocks[0].text, "x");

  assert.throws(() => extractDocumentText(SAMPLE_DOC as never, "t.99"), /not found/);
});

test("extractDocumentText falls back to the legacy body shape", () => {
  const legacy = { documentId: "d1", title: "Doc", body: { content: SAMPLE_CONTENT } };
  const result = extractDocumentText(legacy as never);
  assert.equal(result.tabs.length, 1);
  assert.equal(result.tabs[0].tabId, undefined);
  assert.equal(result.tabs[0].blocks.length, 3);
});

test("extractTabTree keeps nesting without content", () => {
  const tree = extractTabTree(SAMPLE_DOC as never) as {
    tabId: string;
    childTabs?: { tabId: string }[];
    documentTab?: unknown;
  }[];
  assert.equal(tree.length, 1);
  assert.equal(tree[0].tabId, "t.0");
  assert.equal(tree[0].childTabs?.[0].tabId, "t.1");
  assert.equal(tree[0].documentTab, undefined, "content must not leak into the tab tree");
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries a 429 for reads and writes alike", async () => {
  for (const run of [
    () => new GoogleDocsClient(staticConfig({ maxRetries: 3 })).getDocument({ documentId: "d" }),
    () => new GoogleDocsClient(staticConfig({ maxRetries: 3 })).deleteRange({ documentId: "d", startIndex: 1, endIndex: 2 }),
  ]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429 });
      return okJson({ ok: true });
    });
    try {
      assert.deepEqual(await run(), { ok: true });
      assert.equal(n, 2);
    } finally {
      mock.restore();
    }
  }
});

test("request() retries a 5xx only for GET — a write is never replayed", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("unavailable", { status: 503 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleDocsClient(staticConfig({ maxRetries: 3 })).getDocument({ documentId: "d" });
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2, "the read is retried");
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("unavailable", { status: 503 });
  });
  try {
    await assert.rejects(
      () =>
        new GoogleDocsClient(staticConfig({ maxRetries: 3 })).deleteRange({
          documentId: "d",
          startIndex: 1,
          endIndex: 2,
        }),
      /HTTP 503/,
    );
    assert.equal(n, 1, "a 503 on a write must not be replayed — the delete may have committed");
  } finally {
    mock2.restore();
  }
});

test("request() retries a network error only for GET", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleDocsClient(staticConfig({ maxRetries: 2 })).getDocument({ documentId: "d" });
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    throw new Error("ECONNRESET");
  });
  try {
    await assert.rejects(
      () =>
        new GoogleDocsClient(staticConfig({ maxRetries: 2 })).importMarkdown({
          documentId: "d",
          markdown: "# x",
        }),
      /ECONNRESET/,
    );
    assert.equal(n, 1, "a network error on a write must not be replayed");
  } finally {
    mock2.restore();
  }
});

test("request() does not retry a 400 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleDocsClient(staticConfig({ maxRetries: 3 })).getDocument({ documentId: "d" }),
      /HTTP 400: \[INVALID_ARGUMENT\] bad/,
    );
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("slow down", { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleDocsClient(staticConfig({ maxRetries: 2 })).getDocument({ documentId: "d" }),
      /HTTP 429/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("request() aborts and reports a timeout when the request hangs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleDocsClient(staticConfig({ timeoutMs: 10, maxRetries: 0 }));
    await client.getDocument({ documentId: "d" }).then(
      () => assert.fail("must reject"),
      (err) => assert.match(String(err), /timed out after 10ms/),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleDocsClient(staticConfig()).request("GET", evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const result = await new GoogleDocsClient(staticConfig()).request(
      "GET",
      "v1/documents/d1?suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls[0].url, `${BASE}/v1/documents/d1?suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS`);
  } finally {
    mock.restore();
  }
});
