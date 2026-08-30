import type {
  Alignment,
  BaselineOffset,
  BreakKind,
  BulletPreset,
  ExportFormat,
  GoogleDocsConfig,
  NamedStyle,
  SuggestionsViewMode,
  TableAction,
} from "./types.js";
import { GoogleDocsError } from "./types.js";
import { CredentialsError } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** Google's OAuth2 token endpoint — refresh tokens are exchanged here. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Drive export MIME type per normalized format. */
export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  markdown: "text/markdown",
  txt: "text/plain",
  html: "text/html",
  rtf: "application/rtf",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  epub: "application/epub+zip",
};

/** Formats whose export body is text and can be returned inline to the model. */
export const TEXT_EXPORT_FORMATS: ReadonlySet<ExportFormat> = new Set(["markdown", "txt", "html"]);

/**
 * Comment fields requested from the Drive API (the comments endpoints require
 * an explicit `fields` selector). Author emails are not requested — only
 * display names — to keep responses lean and impersonal where possible.
 */
const COMMENT_FIELDS =
  "id,content,anchor,quotedFileContent,resolved,deleted," +
  "author(displayName,me),createdTime,modifiedTime," +
  "replies(id,content,action,author(displayName,me),createdTime,deleted)";

// ---- Normalized -> wire mapping (pure functions, exported for tests) ----

/** Maps a normalized named style to the API's NamedStyleType. */
export function mapNamedStyle(style: NamedStyle): string {
  return style.toUpperCase();
}

/** Maps a normalized alignment to the API's Alignment enum. */
export function mapAlignment(alignment: Alignment): string {
  return { start: "START", center: "CENTER", end: "END", justified: "JUSTIFIED" }[alignment];
}

/** Maps a normalized baseline offset to the API's BaselineOffset enum. */
export function mapBaselineOffset(offset: BaselineOffset): string {
  return { none: "NONE", superscript: "SUPERSCRIPT", subscript: "SUBSCRIPT" }[offset];
}

/** Maps a normalized bullet preset to the API's BulletGlyphPreset. */
export function mapBulletPreset(preset: BulletPreset): string {
  return {
    disc: "BULLET_DISC_CIRCLE_SQUARE",
    arrow: "BULLET_ARROW_DIAMOND_DISC",
    checkbox: "BULLET_CHECKBOX",
    star: "BULLET_STAR_CIRCLE_SQUARE",
    diamond: "BULLET_DIAMOND_CIRCLE_SQUARE",
    decimal: "NUMBERED_DECIMAL_ALPHA_ROMAN",
    decimal_parens: "NUMBERED_DECIMAL_ALPHA_ROMAN_PARENS",
    decimal_nested: "NUMBERED_DECIMAL_NESTED",
    upper_alpha: "NUMBERED_UPPERALPHA_ALPHA_ROMAN",
    upper_roman: "NUMBERED_UPPERROMAN_UPPERALPHA_DECIMAL",
    zero_decimal: "NUMBERED_ZERODECIMAL_ALPHA_ROMAN",
  }[preset];
}

/** Parses "#rrggbb" (or "rrggbb") into the API's normalized RgbColor. */
export function hexToRgbColor(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Invalid color "${hex}" — expected a 6-digit hex color like #1a73e8.`);
  }
  const n = (offset: number) => parseInt(clean.slice(offset, offset + 2), 16) / 255;
  return { red: n(0), green: n(2), blue: n(4) };
}

/** Normalized inputs for style_text. */
export interface TextStyleParams {
  documentId: string;
  startIndex: number;
  endIndex: number;
  tabId?: string;
  segmentId?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  smallCaps?: boolean;
  /** Font size in points. */
  fontSize?: number;
  /** Font family name, e.g. "Roboto". */
  fontFamily?: string;
  /** 6-digit hex colors, e.g. "#1a73e8". */
  foregroundColor?: string;
  backgroundColor?: string;
  /** Link URL; an empty string clears an existing link. */
  linkUrl?: string;
  baselineOffset?: BaselineOffset;
}

/**
 * Builds the updateTextStyle textStyle + fields mask from normalized params.
 * Pure wire mapping — throws when no styling field was provided.
 */
export function buildTextStyle(p: TextStyleParams): { textStyle: Record<string, unknown>; fields: string } {
  const textStyle: Record<string, unknown> = {};
  const fields: string[] = [];
  const set = (field: string, value: unknown) => {
    fields.push(field);
    if (value !== undefined) textStyle[field] = value;
  };

  if (p.bold !== undefined) set("bold", p.bold);
  if (p.italic !== undefined) set("italic", p.italic);
  if (p.underline !== undefined) set("underline", p.underline);
  if (p.strikethrough !== undefined) set("strikethrough", p.strikethrough);
  if (p.smallCaps !== undefined) set("smallCaps", p.smallCaps);
  if (p.fontSize !== undefined) set("fontSize", { magnitude: p.fontSize, unit: "PT" });
  if (p.fontFamily !== undefined) set("weightedFontFamily", { fontFamily: p.fontFamily });
  if (p.foregroundColor !== undefined) {
    set("foregroundColor", { color: { rgbColor: hexToRgbColor(p.foregroundColor) } });
  }
  if (p.backgroundColor !== undefined) {
    set("backgroundColor", { color: { rgbColor: hexToRgbColor(p.backgroundColor) } });
  }
  if (p.linkUrl !== undefined) {
    // Masking "link" while leaving it unset clears the link — that is how an
    // empty string means "remove the link" without a separate parameter.
    set("link", p.linkUrl === "" ? undefined : { url: p.linkUrl });
  }
  if (p.baselineOffset !== undefined) set("baselineOffset", mapBaselineOffset(p.baselineOffset));

  if (fields.length === 0) {
    throw new Error("At least one text style field is required (bold, italic, font_size, ...).");
  }
  return { textStyle, fields: fields.join(",") };
}

/** Normalized inputs for style_paragraph. */
export interface ParagraphStyleParams {
  documentId: string;
  startIndex: number;
  endIndex: number;
  tabId?: string;
  segmentId?: string;
  namedStyle?: NamedStyle;
  alignment?: Alignment;
  /** 100 = single spacing, 200 = double. */
  lineSpacing?: number;
  /** Space above/below the paragraph, points. */
  spaceAbove?: number;
  spaceBelow?: number;
  /** Indents, points. */
  indentStart?: number;
  indentEnd?: number;
  indentFirstLine?: number;
  keepWithNext?: boolean;
  direction?: "ltr" | "rtl";
}

/**
 * Builds the updateParagraphStyle paragraphStyle + fields mask from normalized
 * params. Pure wire mapping — throws when no styling field was provided.
 */
export function buildParagraphStyle(p: ParagraphStyleParams): {
  paragraphStyle: Record<string, unknown>;
  fields: string;
} {
  const paragraphStyle: Record<string, unknown> = {};
  const fields: string[] = [];
  const set = (field: string, value: unknown) => {
    fields.push(field);
    paragraphStyle[field] = value;
  };
  const pt = (magnitude: number) => ({ magnitude, unit: "PT" });

  if (p.namedStyle !== undefined) set("namedStyleType", mapNamedStyle(p.namedStyle));
  if (p.alignment !== undefined) set("alignment", mapAlignment(p.alignment));
  if (p.lineSpacing !== undefined) set("lineSpacing", p.lineSpacing);
  if (p.spaceAbove !== undefined) set("spaceAbove", pt(p.spaceAbove));
  if (p.spaceBelow !== undefined) set("spaceBelow", pt(p.spaceBelow));
  if (p.indentStart !== undefined) set("indentStart", pt(p.indentStart));
  if (p.indentEnd !== undefined) set("indentEnd", pt(p.indentEnd));
  if (p.indentFirstLine !== undefined) set("indentFirstLine", pt(p.indentFirstLine));
  if (p.keepWithNext !== undefined) set("keepWithNext", p.keepWithNext);
  if (p.direction !== undefined) {
    set("direction", p.direction === "rtl" ? "RIGHT_TO_LEFT" : "LEFT_TO_RIGHT");
  }

  if (fields.length === 0) {
    throw new Error("At least one paragraph style field is required (named_style, alignment, ...).");
  }
  return { paragraphStyle, fields: fields.join(",") };
}

// ---- Document text extraction (pure functions, exported for tests) ----

/** One readable block of a document tab, with the indexes range tools need. */
export interface TextBlock {
  start?: number;
  end?: number;
  type: "paragraph" | "table" | "table_of_contents";
  /** namedStyleType when it is not NORMAL_TEXT (headings, title, subtitle). */
  style?: string;
  /** Present (true) when the paragraph is a list item. */
  bullet?: boolean;
  text?: string;
  rows?: number;
  columns?: number;
  /** Table cell plain text, cells[row][column]. */
  cells?: string[][];
}

interface RawStructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: {
      textRun?: { content?: string };
      inlineObjectElement?: { inlineObjectId?: string };
      pageBreak?: unknown;
      footnoteReference?: { footnoteId?: string };
      person?: { personProperties?: { name?: string; email?: string } };
      richLink?: { richLinkProperties?: { title?: string; uri?: string } };
    }[];
    paragraphStyle?: { namedStyleType?: string };
    bullet?: unknown;
  };
  table?: {
    rows?: number;
    columns?: number;
    tableRows?: { tableCells?: { content?: RawStructuralElement[] }[] }[];
  };
  tableOfContents?: { content?: RawStructuralElement[] };
  sectionBreak?: unknown;
}

interface RawTab {
  tabProperties?: { tabId?: string; title?: string; index?: number; nestingLevel?: number };
  documentTab?: { body?: { content?: RawStructuralElement[] } };
  childTabs?: RawTab[];
}

function paragraphText(paragraph: NonNullable<RawStructuralElement["paragraph"]>): string {
  let text = "";
  for (const el of paragraph.elements ?? []) {
    if (el.textRun?.content !== undefined) text += el.textRun.content;
    else if (el.inlineObjectElement) text += `[image:${el.inlineObjectElement.inlineObjectId ?? "?"}]`;
    else if (el.person) text += el.person.personProperties?.name ?? el.person.personProperties?.email ?? "[person]";
    else if (el.richLink) text += el.richLink.richLinkProperties?.title ?? "[link]";
  }
  return text.replace(/\n$/, "");
}

function cellText(content: RawStructuralElement[] | undefined): string {
  const parts: string[] = [];
  for (const block of extractBlocks(content ?? [])) {
    if (block.type === "paragraph") parts.push(block.text ?? "");
    else if (block.type === "table") parts.push("[nested table]");
  }
  return parts.join("\n");
}

/** Flattens a tab's structural elements into readable blocks with indexes. */
export function extractBlocks(content: RawStructuralElement[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const element of content) {
    if (element.paragraph) {
      const block: TextBlock = {
        start: element.startIndex,
        end: element.endIndex,
        type: "paragraph",
        text: paragraphText(element.paragraph),
      };
      const style = element.paragraph.paragraphStyle?.namedStyleType;
      if (style && style !== "NORMAL_TEXT") block.style = style;
      if (element.paragraph.bullet) block.bullet = true;
      blocks.push(block);
    } else if (element.table) {
      blocks.push({
        start: element.startIndex,
        end: element.endIndex,
        type: "table",
        rows: element.table.rows,
        columns: element.table.columns,
        cells: (element.table.tableRows ?? []).map((row) =>
          (row.tableCells ?? []).map((cell) => cellText(cell.content)),
        ),
      });
    } else if (element.tableOfContents) {
      blocks.push({ start: element.startIndex, end: element.endIndex, type: "table_of_contents" });
    }
    // Section breaks carry no text; their indexes are visible in get_document.
  }
  return blocks;
}

function flattenTabs(tabs: RawTab[]): RawTab[] {
  const out: RawTab[] = [];
  for (const tab of tabs) {
    out.push(tab);
    out.push(...flattenTabs(tab.childTabs ?? []));
  }
  return out;
}

/**
 * Turns a documents.get response into readable per-tab blocks. With a tabId
 * only that tab is returned; without one, every tab. Documents always have at
 * least one tab when fetched with includeTabsContent=true; the legacy body
 * shape is handled for robustness.
 */
export function extractDocumentText(
  document: Record<string, unknown>,
  tabId?: string,
): {
  documentId: unknown;
  title: unknown;
  tabs: { tabId?: string; title?: string; blocks: TextBlock[] }[];
} {
  const rawTabs = flattenTabs((document.tabs as RawTab[] | undefined) ?? []);
  let tabs: { tabId?: string; title?: string; blocks: TextBlock[] }[];

  if (rawTabs.length === 0) {
    const body = document.body as { content?: RawStructuralElement[] } | undefined;
    tabs = [{ blocks: extractBlocks(body?.content ?? []) }];
  } else {
    const selected = tabId ? rawTabs.filter((tab) => tab.tabProperties?.tabId === tabId) : rawTabs;
    if (tabId && selected.length === 0) {
      throw new Error(`Tab "${tabId}" not found — call list_tabs to see the document's tabs.`);
    }
    tabs = selected.map((tab) => ({
      tabId: tab.tabProperties?.tabId,
      title: tab.tabProperties?.title,
      blocks: extractBlocks(tab.documentTab?.body?.content ?? []),
    }));
  }

  return { documentId: document.documentId, title: document.title, tabs };
}

/** The tab tree without content: id, title, position and children. */
export function extractTabTree(document: Record<string, unknown>): unknown[] {
  const mapTab = (tab: RawTab): Record<string, unknown> =>
    compact({
      tabId: tab.tabProperties?.tabId,
      title: tab.tabProperties?.title,
      index: tab.tabProperties?.index,
      nestingLevel: tab.tabProperties?.nestingLevel,
      childTabs: tab.childTabs && tab.childTabs.length > 0 ? tab.childTabs.map(mapTab) : undefined,
    });
  return ((document.tabs as RawTab[] | undefined) ?? []).map(mapTab);
}

// ---- Request-building helpers ----

/** A Docs API insertion point: an explicit index or the end of the segment. */
function insertionPoint(
  index: number | undefined,
  tabId?: string,
  segmentId?: string,
): Record<string, unknown> {
  return index === undefined
    ? { endOfSegmentLocation: compact({ tabId, segmentId }) }
    : { location: compact({ index, tabId, segmentId }) };
}

/** A Docs API Range with optional tab/segment addressing. */
function range(
  startIndex: number,
  endIndex: number,
  tabId?: string,
  segmentId?: string,
): Record<string, unknown> {
  return compact({ startIndex, endIndex, tabId, segmentId });
}

export class GoogleDocsClient {
  private readonly docsBase: string;
  private readonly driveBase: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  /** Cached access token from the refresh flow, with its expiry. */
  private cachedToken?: { value: string; expiresAt: number };
  /** In-flight refresh, deduping concurrent token requests. */
  private refreshInFlight?: Promise<string>;

  constructor(private readonly config: GoogleDocsConfig) {
    this.docsBase = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    const driveBase = config.driveApiBase || "https://www.googleapis.com";
    this.driveBase = driveBase.endsWith("/") ? driveBase : driveBase + "/";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  private canRefresh(): boolean {
    return Boolean(this.config.refreshToken && this.config.clientId && this.config.clientSecret);
  }

  /**
   * Returns a valid Bearer token. With the refresh triple configured, mints an
   * access token from the refresh token and caches it until shortly before it
   * expires (concurrent callers share one in-flight refresh); otherwise the
   * static GOOGLE_DOCS_ACCESS_TOKEN is used as-is. With neither configured,
   * throws {@link CredentialsError} BEFORE any fetch — a missing setup must
   * never enter the retry/backoff loop or trigger the 401 re-mint, because no
   * amount of retrying mints credentials.
   */
  private async accessToken(forceRefresh = false): Promise<string> {
    if (!this.canRefresh()) {
      if (!this.config.accessToken) throw new CredentialsError();
      return this.config.accessToken;
    }
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAccessToken().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  /** Exchanges the refresh token for a fresh access token at Google's token endpoint. */
  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId as string,
      client_secret: this.config.clientSecret as string,
      refresh_token: this.config.refreshToken as string,
      grant_type: "refresh_token",
    }).toString();

    const { res, bytes } = await this.fetchWithTimeout(
      TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "oauth2 token refresh",
    );
    const text = decode(bytes);

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) throw new GoogleDocsError(res.status, data);

    const token = (data as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) {
      throw new Error("OAuth2 token endpoint returned no access_token.");
    }
    const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    // Refresh 60s ahead of the real expiry so requests never race a dying token.
    this.cachedToken = { value: token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 };
    return token;
  }

  /** Verifies the OAuth credentials by minting a fresh access token (refresh flow only). */
  async authCheck(): Promise<unknown> {
    if (!this.canRefresh()) {
      throw new Error(
        "authCheck needs the refresh flow (GOOGLE_DOCS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN); with a static GOOGLE_DOCS_ACCESS_TOKEN fetch a document instead.",
      );
    }
    await this.accessToken(true);
    return { ok: true, auth: "refresh_token" };
  }

  /** Backoff before a retry: honors Retry-After when present, else exponential (capped at 30s). */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = res ? Number(res.headers.get("Retry-After")) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers. Bytes, not text: exports can be binary.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; bytes: Uint8Array }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { res, bytes };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The single HTTP door for both Google hosts. Auth is a Bearer token
   * (refreshed transparently; a 401 forces one re-mint + retry). 429 is always
   * retried with backoff; 5xx and network errors/timeouts are retried only for
   * GET — replaying a write (batchUpdate, upload, comment) after an ambiguous
   * failure would duplicate it. The path is resolved against the given base and
   * anything that escapes to a foreign origin is rejected before the token is
   * attached (SSRF guard). Any other non-2xx throws a {@link GoogleDocsError}.
   */
  private async send<T = unknown>(opts: {
    method: HttpMethod;
    base: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    jsonBody?: Record<string, unknown>;
    rawBody?: { contentType: string; data: string };
    binary?: boolean;
  }): Promise<T> {
    const url = new URL(opts.path.replace(/^\//, ""), opts.base);
    if (url.origin !== new URL(opts.base).origin) {
      throw new Error(`request path must be a relative API path (resolved to foreign origin ${url.origin})`);
    }
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const target = url.toString();

    // Guard method !== "GET" keeps undici from crashing on a GET-with-body.
    const hasJson = opts.jsonBody !== undefined && opts.method !== "GET";
    const hasRaw = opts.rawBody !== undefined && opts.method !== "GET";

    // Writes must not be replayed on ambiguous failures (see the retry gate below).
    const idempotent = opts.method === "GET";
    let refreshedOn401 = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (hasJson) headers["Content-Type"] = "application/json";
      if (hasRaw) headers["Content-Type"] = opts.rawBody!.contentType;

      let res: Response;
      let bytes: Uint8Array;
      try {
        ({ res, bytes } = await this.fetchWithTimeout(
          target,
          {
            method: opts.method,
            headers,
            body: hasJson ? JSON.stringify(opts.jsonBody) : hasRaw ? opts.rawBody!.data : undefined,
          },
          opts.path,
        ));
      } catch (err) {
        // Network error or timeout: the request may or may not have reached the
        // API, so only reads are retried; writes rethrow immediately.
        if (idempotent && attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // An expired/revoked access token: re-mint once and replay. The request
      // never executed, so this is safe for writes too.
      if (res.status === 401 && this.canRefresh() && !refreshedOn401) {
        refreshedOn401 = true;
        await this.accessToken(true);
        continue;
      }

      // 429 means the request was rejected before executing — safe to retry for
      // any method. 5xx is ambiguous (the write may have committed), so it is
      // gated to idempotent requests.
      const transient = res.status === 429 || (idempotent && res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      if (!res.ok) {
        const text = decode(bytes);
        let data: unknown = undefined;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        throw new GoogleDocsError(res.status, data);
      }

      if (opts.binary) return bytes as T;

      const text = decode(bytes);
      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as T;
      }
    }
  }

  /**
   * Low-level request to a Google Docs API path (e.g. "v1/documents/abc").
   * This is the raw_request surface — Docs API v1 only uses GET and POST.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.send<T>({ method, base: this.docsBase, path, jsonBody: body, query });
  }

  // ---- Documents ----

  /** Creates an empty document. documents.create accepts only a title. */
  async createDocument(title: string): Promise<unknown> {
    return this.request("POST", "v1/documents", { title });
  }

  /**
   * Creates a document from Markdown via Drive's multipart upload with
   * conversion (mimeType application/vnd.google-apps.document). Returns the
   * Drive file resource — its `id` is the documentId.
   */
  async createDocumentFromMarkdown(p: { title: string; markdown: string }): Promise<unknown> {
    const boundary = `mcp-google-docs-${Date.now().toString(36)}`;
    const metadata = JSON.stringify({ name: p.title, mimeType: "application/vnd.google-apps.document" });
    const data =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${p.markdown}\r\n` +
      `--${boundary}--`;
    return this.send({
      method: "POST",
      base: this.driveBase,
      path: "upload/drive/v3/files",
      query: { uploadType: "multipart", fields: "id,name,mimeType" },
      rawBody: { contentType: `multipart/related; boundary=${boundary}`, data },
    });
  }

  /** Full document structure. includeTabsContent=true populates every tab. */
  async getDocument(p: {
    documentId: string;
    includeTabsContent?: boolean;
    suggestionsViewMode?: SuggestionsViewMode;
  }): Promise<unknown> {
    return this.request(
      "GET",
      `v1/documents/${encodeURIComponent(p.documentId)}`,
      undefined,
      compact({
        includeTabsContent: p.includeTabsContent,
        suggestionsViewMode: p.suggestionsViewMode,
      }),
    );
  }

  /** Document as readable per-tab blocks with the indexes range tools need. */
  async readDocumentText(p: { documentId: string; tabId?: string }): Promise<unknown> {
    const document = (await this.getDocument({
      documentId: p.documentId,
      includeTabsContent: true,
    })) as Record<string, unknown>;
    return extractDocumentText(document, p.tabId);
  }

  /** The tab tree (ids, titles, order, nesting) without any content. */
  async listTabs(documentId: string): Promise<unknown> {
    const document = (await this.getDocument({ documentId, includeTabsContent: true })) as Record<
      string,
      unknown
    >;
    return { documentId: document.documentId, title: document.title, tabs: extractTabTree(document) };
  }

  /** Low-level batchUpdate — the write channel for every document mutation. */
  async batchUpdate(documentId: string, requests: unknown[]): Promise<unknown> {
    return this.request("POST", `v1/documents/${encodeURIComponent(documentId)}:batchUpdate`, {
      requests,
    });
  }

  // ---- Text ----

  /** Inserts text at an index, or at the end of the body/segment when index is omitted. */
  async insertText(p: {
    documentId: string;
    text: string;
    index?: number;
    tabId?: string;
    segmentId?: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      { insertText: { text: p.text, ...insertionPoint(p.index, p.tabId, p.segmentId) } },
    ]);
  }

  /** Deletes the content in [startIndex, endIndex). */
  async deleteRange(p: {
    documentId: string;
    startIndex: number;
    endIndex: number;
    tabId?: string;
    segmentId?: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      { deleteContentRange: { range: range(p.startIndex, p.endIndex, p.tabId, p.segmentId) } },
    ]);
  }

  /**
   * Replaces the content in [startIndex, endIndex) with new text: one
   * batchUpdate deleting the range and inserting at its start, applied
   * atomically in order. Empty text degrades to a plain delete.
   */
  async replaceRange(p: {
    documentId: string;
    startIndex: number;
    endIndex: number;
    text: string;
    tabId?: string;
    segmentId?: string;
  }): Promise<unknown> {
    const requests: unknown[] = [
      { deleteContentRange: { range: range(p.startIndex, p.endIndex, p.tabId, p.segmentId) } },
    ];
    if (p.text !== "") {
      requests.push({
        insertText: {
          text: p.text,
          location: compact({ index: p.startIndex, tabId: p.tabId, segmentId: p.segmentId }),
        },
      });
    }
    return this.batchUpdate(p.documentId, requests);
  }

  /** Replaces every occurrence of a string, optionally only in given tabs. */
  async replaceAllText(p: {
    documentId: string;
    find: string;
    replace: string;
    matchCase?: boolean;
    tabIds?: string[];
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      {
        replaceAllText: compact({
          containsText: { text: p.find, matchCase: p.matchCase ?? true },
          replaceText: p.replace,
          tabsCriteria: p.tabIds && p.tabIds.length > 0 ? { tabIds: p.tabIds } : undefined,
        }),
      },
    ]);
  }

  // ---- Styles ----

  /** Applies character styles over a range with a computed fields mask. */
  async updateTextStyle(p: TextStyleParams): Promise<unknown> {
    const { textStyle, fields } = buildTextStyle(p);
    return this.batchUpdate(p.documentId, [
      {
        updateTextStyle: {
          textStyle,
          fields,
          range: range(p.startIndex, p.endIndex, p.tabId, p.segmentId),
        },
      },
    ]);
  }

  /** Applies paragraph styles over a range with a computed fields mask. */
  async updateParagraphStyle(p: ParagraphStyleParams): Promise<unknown> {
    const { paragraphStyle, fields } = buildParagraphStyle(p);
    return this.batchUpdate(p.documentId, [
      {
        updateParagraphStyle: {
          paragraphStyle,
          fields,
          range: range(p.startIndex, p.endIndex, p.tabId, p.segmentId),
        },
      },
    ]);
  }

  /** Turns the paragraphs overlapping the range into a list with the given preset. */
  async createParagraphBullets(p: {
    documentId: string;
    startIndex: number;
    endIndex: number;
    preset: BulletPreset;
    tabId?: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      {
        createParagraphBullets: {
          range: range(p.startIndex, p.endIndex, p.tabId),
          bulletPreset: mapBulletPreset(p.preset),
        },
      },
    ]);
  }

  /** Removes list bullets from the paragraphs overlapping the range. */
  async deleteParagraphBullets(p: {
    documentId: string;
    startIndex: number;
    endIndex: number;
    tabId?: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      { deleteParagraphBullets: { range: range(p.startIndex, p.endIndex, p.tabId) } },
    ]);
  }

  // ---- Tables ----

  /** Inserts an empty rows x columns table at an index or the end of the segment. */
  async insertTable(p: {
    documentId: string;
    rows: number;
    columns: number;
    index?: number;
    tabId?: string;
    segmentId?: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      {
        insertTable: {
          rows: p.rows,
          columns: p.columns,
          ...insertionPoint(p.index, p.tabId, p.segmentId),
        },
      },
    ]);
  }

  /** Inserts or deletes a row/column, addressed by the table's start index. */
  async editTable(p: {
    documentId: string;
    action: TableAction;
    tableStartIndex: number;
    rowIndex?: number;
    columnIndex?: number;
    insertBelow?: boolean;
    insertRight?: boolean;
    tabId?: string;
  }): Promise<unknown> {
    const tableCellLocation = {
      tableStartLocation: compact({ index: p.tableStartIndex, tabId: p.tabId }),
      rowIndex: p.rowIndex ?? 0,
      columnIndex: p.columnIndex ?? 0,
    };
    const request = {
      insert_row: { insertTableRow: { tableCellLocation, insertBelow: p.insertBelow ?? true } },
      insert_column: { insertTableColumn: { tableCellLocation, insertRight: p.insertRight ?? true } },
      delete_row: { deleteTableRow: { tableCellLocation } },
      delete_column: { deleteTableColumn: { tableCellLocation } },
    }[p.action];
    return this.batchUpdate(p.documentId, [request]);
  }

  // ---- Breaks ----

  /** Inserts a page break or a section break (next-page / continuous). */
  async insertBreak(p: {
    documentId: string;
    kind: BreakKind;
    index?: number;
    tabId?: string;
    segmentId?: string;
  }): Promise<unknown> {
    const point = insertionPoint(p.index, p.tabId, p.segmentId);
    const request =
      p.kind === "page"
        ? { insertPageBreak: point }
        : {
            insertSectionBreak: {
              sectionType: p.kind === "section_next_page" ? "NEXT_PAGE" : "CONTINUOUS",
              ...point,
            },
          };
    return this.batchUpdate(p.documentId, [request]);
  }

  // ---- Images ----

  /** Inserts an inline image from a public URI, with optional size in points. */
  async insertImage(p: {
    documentId: string;
    uri: string;
    index?: number;
    widthPt?: number;
    heightPt?: number;
    tabId?: string;
    segmentId?: string;
  }): Promise<unknown> {
    const objectSize =
      p.widthPt !== undefined || p.heightPt !== undefined
        ? compact({
            width: p.widthPt !== undefined ? { magnitude: p.widthPt, unit: "PT" } : undefined,
            height: p.heightPt !== undefined ? { magnitude: p.heightPt, unit: "PT" } : undefined,
          })
        : undefined;
    return this.batchUpdate(p.documentId, [
      {
        insertInlineImage: compact({
          uri: p.uri,
          objectSize,
          ...insertionPoint(p.index, p.tabId, p.segmentId),
        }),
      },
    ]);
  }

  /** Replaces an existing image's contents, keeping its size and position. */
  async replaceImage(p: {
    documentId: string;
    imageObjectId: string;
    uri: string;
    tabId?: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.documentId, [
      {
        replaceImage: compact({
          imageObjectId: p.imageObjectId,
          uri: p.uri,
          imageReplaceMethod: "CENTER_CROP",
          tabId: p.tabId,
        }),
      },
    ]);
  }

  // ---- Markdown / export (Drive, internal dependency) ----

  /** Exports the document via Drive in the given format; bytes, possibly binary. */
  async exportDocument(p: { documentId: string; format: ExportFormat }): Promise<Uint8Array> {
    return this.send<Uint8Array>({
      method: "GET",
      base: this.driveBase,
      path: `drive/v3/files/${encodeURIComponent(p.documentId)}/export`,
      query: { mimeType: EXPORT_MIME_TYPES[p.format] },
      binary: true,
    });
  }

  /**
   * Replaces the ENTIRE document content with the given Markdown via Drive's
   * media upload with conversion. Destructive by design: everything the
   * Markdown does not express (comments anchors, positioned objects, extra
   * tabs) is gone afterwards.
   */
  async importMarkdown(p: { documentId: string; markdown: string }): Promise<unknown> {
    return this.send({
      method: "PATCH",
      base: this.driveBase,
      path: `upload/drive/v3/files/${encodeURIComponent(p.documentId)}`,
      query: { uploadType: "media", fields: "id,name,mimeType,modifiedTime" },
      rawBody: { contentType: "text/markdown; charset=UTF-8", data: p.markdown },
    });
  }

  // ---- Comments (Drive, internal dependency) ----

  /** Lists the document's comments with replies and resolution state. */
  async listComments(p: {
    documentId: string;
    pageSize?: number;
    pageToken?: string;
    includeDeleted?: boolean;
  }): Promise<unknown> {
    return this.send({
      method: "GET",
      base: this.driveBase,
      path: `drive/v3/files/${encodeURIComponent(p.documentId)}/comments`,
      query: compact({
        fields: `comments(${COMMENT_FIELDS}),nextPageToken`,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
        includeDeleted: p.includeDeleted,
      }),
    });
  }

  /**
   * Creates an unanchored comment (optionally citing quoted text). The Drive
   * API's anchor format for Docs ranges is not public, so range-anchored
   * comments cannot be created programmatically.
   */
  async createComment(p: { documentId: string; content: string; quotedText?: string }): Promise<unknown> {
    return this.send({
      method: "POST",
      base: this.driveBase,
      path: `drive/v3/files/${encodeURIComponent(p.documentId)}/comments`,
      query: { fields: COMMENT_FIELDS },
      jsonBody: compact({
        content: p.content,
        quotedFileContent: p.quotedText ? { value: p.quotedText } : undefined,
      }),
    });
  }

  /**
   * Replies to a comment. action "resolve" closes the comment thread,
   * "reopen" reactivates it; both may carry reply text.
   */
  async replyComment(p: {
    documentId: string;
    commentId: string;
    content?: string;
    action?: "resolve" | "reopen";
  }): Promise<unknown> {
    return this.send({
      method: "POST",
      base: this.driveBase,
      path: `drive/v3/files/${encodeURIComponent(p.documentId)}/comments/${encodeURIComponent(p.commentId)}/replies`,
      query: { fields: "id,content,action,author(displayName,me),createdTime" },
      jsonBody: compact({ content: p.content, action: p.action }),
    });
  }

  /** Permanently deletes a comment and its replies. */
  async deleteComment(p: { documentId: string; commentId: string }): Promise<unknown> {
    return this.send({
      method: "DELETE",
      base: this.driveBase,
      path: `drive/v3/files/${encodeURIComponent(p.documentId)}/comments/${encodeURIComponent(p.commentId)}`,
    });
  }

  /**
   * Deletes the Drive file. NOT exposed as a tool — used only by the opt-in
   * live smoke scenario to clean up its disposable document.
   */
  async deleteFile(fileId: string): Promise<unknown> {
    return this.send({
      method: "DELETE",
      base: this.driveBase,
      path: `drive/v3/files/${encodeURIComponent(fileId)}`,
    });
  }
}

/** Drops keys whose value is `undefined` so they are not sent to the API. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
