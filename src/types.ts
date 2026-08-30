/**
 * The server talks to the Google Docs API v1 (https://docs.googleapis.com,
 * REST over JSON). Markdown import/export, document export and comments have
 * no Docs API endpoints — they go through the Drive API v3
 * (https://www.googleapis.com) as an internal dependency; no general-purpose
 * Drive tool is exposed. Auth is Google OAuth 2.0: a Bearer access token,
 * minted on demand from a refresh token via https://oauth2.googleapis.com/token
 * (or a static short-lived access token, mostly for testing).
 */

/** Normalized named paragraph styles; mapped to NAMED_STYLE_TYPE wire values. */
export type NamedStyle =
  | "normal_text"
  | "title"
  | "subtitle"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "heading_4"
  | "heading_5"
  | "heading_6";

/** Normalized paragraph alignment; mapped to START/CENTER/END/JUSTIFIED. */
export type Alignment = "start" | "center" | "end" | "justified";

/** Normalized baseline offset; mapped to NONE/SUPERSCRIPT/SUBSCRIPT. */
export type BaselineOffset = "none" | "superscript" | "subscript";

/**
 * Normalized bullet presets; mapped to the API's BulletGlyphPreset values
 * (BULLET_DISC_CIRCLE_SQUARE, NUMBERED_DECIMAL_ALPHA_ROMAN, ...).
 */
export type BulletPreset =
  | "disc"
  | "arrow"
  | "checkbox"
  | "star"
  | "diamond"
  | "decimal"
  | "decimal_parens"
  | "decimal_nested"
  | "upper_alpha"
  | "upper_roman"
  | "zero_decimal";

/** Break kinds for insert_break; section breaks map to SectionType wire values. */
export type BreakKind = "page" | "section_next_page" | "section_continuous";

/** Table actions for edit_table. */
export type TableAction = "insert_row" | "insert_column" | "delete_row" | "delete_column";

/** Comment actions for manage_comment (Drive API comments/replies). */
export type CommentAction = "create" | "reply" | "resolve" | "reopen" | "delete";

/** Export formats; mapped to Drive export MIME types. */
export type ExportFormat = "markdown" | "txt" | "html" | "rtf" | "pdf" | "docx" | "odt" | "epub";

/** Suggestions view modes (API wire values, passed through). */
export type SuggestionsViewMode =
  | "DEFAULT_FOR_CURRENT_ACCESS"
  | "SUGGESTIONS_INLINE"
  | "PREVIEW_SUGGESTIONS_ACCEPTED"
  | "PREVIEW_WITHOUT_SUGGESTIONS";

export interface GoogleDocsConfig {
  /** OAuth2 client id (refresh flow). */
  clientId?: string;
  /** OAuth2 client secret (refresh flow). Treated as a secret. */
  clientSecret?: string;
  /** OAuth2 refresh token, exchanged for access tokens. Treated as a secret. */
  refreshToken?: string;
  /** Static access token (short-lived, ~1h). Used only when the refresh triple is absent. Treated as a secret. */
  accessToken?: string;
  /** Docs API root. Defaults to https://docs.googleapis.com. */
  apiBase: string;
  /** Drive API root (markdown/export/comments). Defaults to https://www.googleapis.com. */
  driveApiBase: string;
  /** Per-request timeout in milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
  /** Max retries for transient errors (429 always; 5xx/network for reads). Defaults to 3. */
  maxRetries?: number;
  /** Base backoff in milliseconds, doubled each retry. Defaults to 500. */
  retryBaseMs?: number;
}

/**
 * Google APIs report failures as a non-2xx HTTP status with a JSON envelope
 * ({ error: { code, message, status, details } }); the OAuth token endpoint
 * uses { error, error_description }. The parsed body is kept alongside the
 * status and a short readable message is derived.
 */
export class GoogleDocsError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}: ${formatErrorBody(body)}`);
    this.name = "GoogleDocsError";
    this.status = status;
    this.body = body;
  }
}

/** Turns a parsed Google API error body into a short, readable message. */
function formatErrorBody(body: unknown): string {
  if (body == null) return "(no body)";
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body !== "object") return String(body);
  const obj = body as Record<string, unknown>;

  // OAuth token endpoint style: { error: "invalid_grant", error_description: "..." }
  if (typeof obj.error === "string") {
    const description = typeof obj.error_description === "string" ? `: ${obj.error_description}` : "";
    return `${obj.error}${description}`.slice(0, 500);
  }

  // Google API envelope: { error: { code, message, status, details } }
  const err = (typeof obj.error === "object" && obj.error !== null ? obj.error : obj) as Record<string, unknown>;
  if (typeof err.message === "string") {
    const status = typeof err.status === "string" ? `[${err.status}] ` : "";
    return `${status}${err.message}`.slice(0, 500);
  }

  return JSON.stringify(obj).slice(0, 500);
}
