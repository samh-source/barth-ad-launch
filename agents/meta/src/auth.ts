/**
 * Meta Marketing API authentication: token debug, expiry check, optional refresh.
 * Uses Graph API debug_token and oauth/access_token (refresh).
 */

import type { ClientWithMeta } from "core";
import type { MetaTokenInfo } from "./types.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
/** Days before expiry to consider "expiring soon" and try refresh or alert */
const EXPIRY_WARNING_DAYS = 7;
const SECONDS_PER_DAY = 86400;

function getAppCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/**
 * Build an app access token (app_id|app_secret) for calling debug_token.
 * Requires META_APP_ID and META_APP_SECRET in env.
 */
export function getAppAccessToken(): string | null {
  const creds = getAppCredentials();
  if (!creds) return null;
  return `${creds.appId}|${creds.appSecret}`;
}

/**
 * Call Graph API debug_token to get token metadata.
 * Requires appAccessToken (app token) to inspect the user token.
 */
export async function debugToken(
  inputToken: string,
  appAccessToken: string
): Promise<MetaTokenInfo> {
  const url = new URL(`${GRAPH_BASE}/debug_token`);
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", appAccessToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    data?: {
      is_valid?: boolean;
      expires_at?: number;
      data_access_expires_at?: number;
      app_id?: string;
      user_id?: string;
      scopes?: string[];
    };
    error?: { message: string; type: string; code: number };
  };

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta debug_token failed: ${msg}`);
  }

  const d = data.data;
  if (!d) throw new Error("Meta debug_token: missing data");

  const info: MetaTokenInfo = {
    isValid: Boolean(d.is_valid),
    expiresAt: d.expires_at ?? 0,
    dataAccessExpiresAt: d.data_access_expires_at ?? 0,
    appId: String(d.app_id ?? ""),
  };
  if (d.user_id != null) info.userId = String(d.user_id);
  if (Array.isArray(d.scopes)) info.scopes = d.scopes;
  return info;
}

/**
 * Get token info for a client. Uses app token from META_APP_ID/META_APP_SECRET.
 * If app credentials are missing, returns null (caller can still use token but won't get expiry).
 */
export async function getTokenInfo(client: ClientWithMeta): Promise<MetaTokenInfo | null> {
  const appToken = getAppAccessToken();
  if (!appToken) return null;
  return debugToken(client.metaAccessToken, appToken);
}

/**
 * Check if token expires within the next N days (or already expired).
 */
export function isExpiringWithinDays(expiresAt: number, days: number): boolean {
  if (expiresAt === 0) return false; // no expiration (e.g. system user)
  const now = Math.floor(Date.now() / 1000);
  const threshold = now + days * SECONDS_PER_DAY;
  return expiresAt <= threshold;
}

/**
 * Exchange a short-lived or long-lived token for a new long-lived token.
 * Returns the new access_token and expires_in (seconds).
 * Requires META_APP_ID and META_APP_SECRET.
 */
export async function refreshAccessToken(
  currentToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const creds = getAppCredentials();
  if (!creds) return null;

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", creds.appId);
  url.searchParams.set("client_secret", creds.appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string; type: string; code: number };
  };

  if (!res.ok || data.error || !data.access_token) {
    return null;
  }
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 0,
  };
}

export interface EnsureValidTokenResult {
  /** Whether the token is valid and (if checked) not expiring soon */
  valid: boolean;
  /** If we refreshed, the new token to use (caller should persist) */
  token?: string;
  /** If we refreshed, approximate new expiry (Unix seconds) */
  expiresAt?: number;
  /** Reason when valid: false */
  reason?: string;
}

/**
 * Ensure the client's Meta token is valid and optionally refresh if expiring soon.
 * Sends token alert via core notifications when token is invalid, expired, or refresh failed.
 * Returns the token to use (current or refreshed) and whether it's valid.
 */
export async function ensureValidToken(
  client: ClientWithMeta,
  options: {
    logger: { warn: (msg: string, ctx?: Record<string, unknown>) => void; info: (msg: string, ctx?: Record<string, unknown>) => void };
    sendTokenAlert: (payload: { clientName: string; platform: "meta"; message: string; expiresAt?: string }) => Promise<{ sent: boolean }>;
    /** Try to refresh if expiring within this many days (default 7) */
    expiryWarningDays?: number;
  }
): Promise<EnsureValidTokenResult> {
  const { logger, sendTokenAlert, expiryWarningDays = EXPIRY_WARNING_DAYS } = options;
  const ctx = { clientName: client.clientName, agent: "meta" };

  const appToken = getAppAccessToken();
  if (!appToken) {
    logger.warn("Meta auth: META_APP_ID/META_APP_SECRET not set; cannot verify token expiry", ctx);
    return { valid: true };
  }

  let info: MetaTokenInfo;
  try {
    info = await debugToken(client.metaAccessToken, appToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Meta auth: debug_token failed: ${message}`, ctx);
    await sendTokenAlert({
      clientName: client.clientName,
      platform: "meta",
      message: `Token verification failed: ${message}. Please re-authorize in Meta Business Manager.`,
    });
    return { valid: false, reason: message };
  }

  if (!info.isValid) {
    const payload: { clientName: string; platform: "meta"; message: string; expiresAt?: string } = {
      clientName: client.clientName,
      platform: "meta",
      message: "Token is invalid or revoked. Please re-authorize in Meta Business Manager.",
    };
    if (info.expiresAt > 0) payload.expiresAt = new Date(info.expiresAt * 1000).toISOString();
    await sendTokenAlert(payload);
    return { valid: false, reason: "Token invalid or revoked" };
  }

  const expiringSoon = isExpiringWithinDays(info.expiresAt, expiryWarningDays);
  if (expiringSoon && info.expiresAt > 0) {
    const refreshed = await refreshAccessToken(client.metaAccessToken);
    if (refreshed?.access_token) {
      logger.info("Meta auth: token refreshed successfully", ctx);
      const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
      return {
        valid: true,
        token: refreshed.access_token,
        expiresAt: newExpiresAt,
      };
    }
    const expiresAtIso = new Date(info.expiresAt * 1000).toISOString();
    await sendTokenAlert({
      clientName: client.clientName,
      platform: "meta",
      message: `Token expires soon (${expiresAtIso}). Refresh failed or not configured. Please re-authorize in Meta Business Manager.`,
      expiresAt: expiresAtIso,
    });
    return {
      valid: false,
      reason: "Token expiring soon and refresh failed",
    };
  }

  return { valid: true };
}
