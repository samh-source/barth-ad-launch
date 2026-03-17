/**
 * TikTok Marketing API authentication: refresh access token, expiry check, alerts.
 */

import type { ClientWithTikTok } from "core";

const OAUTH_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const ACCESS_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

function getAppCredentials(): { clientKey: string; clientSecret: string } | null {
  const key = process.env.TIKTOK_CLIENT_KEY?.trim();
  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!key || !secret) return null;
  return { clientKey: key, clientSecret: secret };
}

export interface RefreshResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Refresh TikTok access token using refresh_token.
 * Requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in env.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  const creds = getAppCredentials();
  if (!creds) return null;

  const body = new URLSearchParams({
    client_key: creds.clientKey,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    description?: string;
  };

  if (!res.ok || !data.access_token) {
    return null;
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in ?? ACCESS_TOKEN_EXPIRY_SECONDS,
  };
}

export interface EnsureValidTokenResult {
  valid: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
  reason?: string;
}

/**
 * Ensure the client's TikTok token is valid. Refreshes using refresh_token if available.
 * Sends token alert when refresh fails.
 */
export async function ensureValidToken(
  client: ClientWithTikTok,
  options: {
    logger: { warn: (msg: string, ctx?: Record<string, unknown>) => void; info: (msg: string, ctx?: Record<string, unknown>) => void };
    sendTokenAlert: (payload: { clientName: string; platform: "tiktok"; message: string; expiresAt?: string }) => Promise<{ sent: boolean }>;
  }
): Promise<EnsureValidTokenResult> {
  const { logger, sendTokenAlert } = options;
  const ctx = { clientName: client.clientName, agent: "tiktok" };

  const refreshToken = client.tiktokRefreshToken;
  if (!refreshToken) {
    logger.warn("TikTok auth: no refresh token; using current access token (may expire in 24h)", ctx);
    return { valid: true };
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (refreshed) {
    logger.info("TikTok auth: token refreshed successfully", ctx);
    const expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
    return {
      valid: true,
      token: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt,
    };
  }

  await sendTokenAlert({
    clientName: client.clientName,
    platform: "tiktok",
    message:
      "TikTok token refresh failed. Please re-authorize in TikTok for Business. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET if not set.",
  });
  return { valid: false, reason: "Token refresh failed" };
}
