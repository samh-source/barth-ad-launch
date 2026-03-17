/**
 * Meta agent types. Extended as we add campaigns, ad sets, ads, etc.
 */

/** Result of debugging a Meta access token (Graph API debug_token) */
export interface MetaTokenInfo {
  isValid: boolean;
  /** Unix timestamp; 0 means no expiration (e.g. system user token) */
  expiresAt: number;
  /** Unix timestamp for data access expiry */
  dataAccessExpiresAt: number;
  appId: string;
  userId?: string;
  scopes?: string[];
}

/** Meta Graph API error shape */
export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/** Ad account fields we care about (minimal for connection check) */
export interface MetaAdAccount {
  id: string;
  name?: string;
  account_id?: string;
  account_status?: number;
}

/** Meta insights action (e.g. purchase, link_click) */
export interface MetaInsightsAction {
  action_type: string;
  value?: string;
}

/** Single insights row from Meta (spend/impressions/actions) */
export interface MetaInsightsRow {
  spend?: string;
  impressions?: string;
  actions?: MetaInsightsAction[];
}

/** Campaign from Graph API with optional insights */
export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  objective?: string;
  insights?: { data?: MetaInsightsRow[] };
}

/** Ad set from Graph API with optional insights */
export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: { data?: MetaInsightsRow[] };
}

/** Ad from Graph API with optional insights and creative */
export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id?: string;
  creative?: { id: string };
  insights?: { data?: MetaInsightsRow[] };
}

/** Ad creative from Graph API (for copy read/update) */
export interface MetaAdCreative {
  id: string;
  name?: string;
  body?: string;
  title?: string;
  object_story_spec?: string | Record<string, unknown>;
  link_url?: string;
  image_url?: string;
}

/** Parsed performance for one object (campaign/ad set/ad) */
export interface MetaPerformance {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cpa: number;
}
