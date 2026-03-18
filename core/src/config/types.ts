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
 * Meta ad set geo targeting: either country list or radius around a point (for Barth).
 * @see https://developers.facebook.com/docs/marketing-api/audiences/reference/advanced-targeting
 */
export interface MetaTargeting {
  /** Country codes, e.g. ["US", "CA"]; required when using custom_locations in some cases */
  geo_locations?: {
    countries?: string[];
    /** Target within radius of a point; radius in miles (default 10) */
    custom_locations?: Array<{
      latitude: number;
      longitude: number;
      radius?: number;
      distance_unit?: "mile" | "kilometer";
    }>;
  };
}

export type TikTokLaunchMode = "website_traffic" | "awareness";

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
  /** Website URL for video ad destination (required by Meta for some accounts; used by Barth) */
  metaWebsiteUrl?: string;
  /** ISO date string when the Meta token expires; used for refresh and expiry alerts */
  metaTokenExpiresAt?: string;
  /** Default geo targeting for Barth (e.g. 10-mile radius around business); used when creating ad set */
  metaTargeting?: MetaTargeting;

  // TikTok (optional)
  tiktokAdvertiserId?: string;
  tiktokAccessToken?: string;
  /** Required for auto-refreshing the TikTok access token */
  tiktokRefreshToken?: string;
  /** ISO date when the TikTok refresh token expires (e.g. 365 days) */
  tiktokRefreshTokenExpiresAt?: string;
  /** Barth launch default for TikTok. */
  tiktokLaunchMode?: TikTokLaunchMode;
  /**
   * TikTok geo targeting uses platform location IDs instead of Meta-style radius targeting.
   * Barth treats this as the TikTok equivalent of the business-area targeting default.
   */
  tiktokLocationIds?: string[];
  /** Landing page URL for TikTok website traffic launches. */
  tiktokWebsiteUrl?: string;
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
