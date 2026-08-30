import type { GoogleDocsConfig } from "./types.js";

/** Default Google Docs API host. */
export const DEFAULT_BASE = "https://docs.googleapis.com";

/** Default Drive API host (markdown import/export, document export, comments). */
export const DEFAULT_DRIVE_BASE = "https://www.googleapis.com";

/**
 * A malformed environment variable. Thrown instead of exiting on the spot so
 * index.ts can catch it, report the drop-off and start degraded instead of
 * dying; `reason` is the machine-readable code that ships with that ping
 * (never a variable's value).
 */
export class ConfigError extends Error {
  readonly reason: string;

  constructor(message: string, reason: string) {
    super(message);
    this.name = "ConfigError";
    this.reason = reason;
  }
}

/**
 * What a tool call without credentials reads. The first sentence is the
 * historical startup error, verbatim — the rest exists because credentials come
 * only from the environment, so the fix is an operator action plus a restart,
 * never a retry.
 */
export const MISSING_CREDENTIALS_MESSAGE =
  "Google OAuth credentials are required: set GOOGLE_DOCS_CLIENT_ID + " +
  "GOOGLE_DOCS_CLIENT_SECRET + GOOGLE_DOCS_REFRESH_TOKEN (recommended), or " +
  "GOOGLE_DOCS_ACCESS_TOKEN with a short-lived access token. " +
  "This is not a network failure and retrying will not help: the operator must set these " +
  "environment variables in the MCP client's server config and restart the server — they are " +
  "read only at startup.";

/**
 * Raised when a tool call needs credentials and none were configured. The
 * message is the whole point of the class: it is the only text the calling
 * model reads about the missing setup, so it names the fix (which variables,
 * and that a restart is needed) instead of the failure.
 */
export class CredentialsError extends Error {
  constructor(message: string = MISSING_CREDENTIALS_MESSAGE) {
    super(message);
    this.name = "CredentialsError";
  }
}

/** True when the config carries usable credentials (the full refresh triple or a static token). */
export function hasCredentials(config: GoogleDocsConfig): boolean {
  return Boolean(config.accessToken || (config.clientId && config.clientSecret && config.refreshToken));
}

/**
 * Builds the client config from environment variables.
 *
 * Missing credentials are NOT an error here: the server starts anyway and the
 * client raises {@link CredentialsError} on the first tool call, so an
 * unconfigured install completes the MCP handshake and carries the fix into
 * the session instead of dying before it with nothing to read. A malformed
 * setup — the refresh triple set only partially — still throws, because
 * guessing what the user meant is worse.
 *
 *   GOOGLE_DOCS_CLIENT_ID       OAuth2 client id      (refresh flow, recommended)
 *   GOOGLE_DOCS_CLIENT_SECRET   OAuth2 client secret  (refresh flow)
 *   GOOGLE_DOCS_REFRESH_TOKEN   OAuth2 refresh token  (refresh flow)
 *   GOOGLE_DOCS_ACCESS_TOKEN    static access token (alternative; expires in ~1h)
 *   GOOGLE_DOCS_API_BASE        Docs API root override (default https://docs.googleapis.com)
 *   GOOGLE_DOCS_DRIVE_API_BASE  Drive API root override (default https://www.googleapis.com)
 *   GOOGLE_DOCS_TIMEOUT_MS      per-request timeout (default 60000)
 *   GOOGLE_DOCS_MAX_RETRIES     retries on transient errors (default 3)
 */
export function loadConfig(): GoogleDocsConfig {
  const clientId = process.env.GOOGLE_DOCS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DOCS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DOCS_REFRESH_TOKEN;
  const accessToken = process.env.GOOGLE_DOCS_ACCESS_TOKEN;

  const oauthProvided = [clientId, clientSecret, refreshToken].filter(Boolean).length;
  if (oauthProvided > 0 && oauthProvided < 3) {
    throw new ConfigError(
      "GOOGLE_DOCS_CLIENT_ID, GOOGLE_DOCS_CLIENT_SECRET and GOOGLE_DOCS_REFRESH_TOKEN must be set together (OAuth2 refresh flow).",
      "incomplete_oauth_config",
    );
  }

  const timeoutMs = Number(process.env.GOOGLE_DOCS_TIMEOUT_MS);
  const maxRetries = Number(process.env.GOOGLE_DOCS_MAX_RETRIES);

  return {
    clientId,
    clientSecret,
    refreshToken,
    accessToken,
    apiBase: process.env.GOOGLE_DOCS_API_BASE || DEFAULT_BASE,
    driveApiBase: process.env.GOOGLE_DOCS_DRIVE_API_BASE || DEFAULT_DRIVE_BASE,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 3,
  };
}
