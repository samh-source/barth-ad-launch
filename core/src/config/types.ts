/**
 * Performance thresholds per client. Used to decide underperformers and budget changes.
 */
export interface ClientThresholds {
  /** Minimum return on ad spend (e.g. 2 = 2x) */
  minROAS?: number;
  /** Maximum cost per acquisition */
  maxCPA?: number;
  /** Minimum spend before evaluating performance (avoid early pause) */
  minSpendToEvaluate?: number;
  /** Minimum number of conversions before applying CPA/ROAS rules */
  minConversionsToEvaluate?: number;
}

/**
 * Single client configuration. Meta and TikTok fields are optional;
 * agents skip clients that don't have the relevant credentials.
 */
export interface ClientConfig {
  clientName: string;
  notificationEmail?: string;
  thresholds?: ClientThresholds;

  // Meta (optional)
  metaAccountId?: string;
  metaAccessToken?: string;
  /** Facebook Page ID (required for video ad creatives; used by Barth) */
  metaPageId?: string;
  /** ISO date string when the Meta token expires; used for refresh and expiry alerts */
  metaTokenExpiresAt?: string;

  // TikTok (optional)
  tiktokAdvertiserId?: string;
  tiktokAccessToken?: string;
  /** Required for auto-refreshing the TikTok access token */
  tiktokRefreshToken?: string;
  /** ISO date when the TikTok refresh token expires (e.g. 365 days) */
  tiktokRefreshTokenExpiresAt?: string;
}

/** Client that has Meta credentials present and valid for loading */
export interface ClientWithMeta extends ClientConfig {
  metaAccountId: string;
  metaAccessToken: string;
}

/** Client that has TikTok credentials present and valid for loading */
export interface ClientWithTikTok extends ClientConfig {
  tiktokAdvertiserId: string;
  tiktokAccessToken: string;
}

export function isClientWithMeta(c: ClientConfig): c is ClientWithMeta {
  return Boolean(c.metaAccountId && c.metaAccessToken);
}

export function isClientWithTikTok(c: ClientConfig): c is ClientWithTikTok {
  return Boolean(c.tiktokAdvertiserId && c.tiktokAccessToken);
}
