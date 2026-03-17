/**
 * TikTok agent types. Mirror Meta where applicable.
 */

/** TikTok API common response wrapper */
export interface TikTokApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  request_id?: string;
}

/** Pagination info from TikTok list endpoints */
export interface TikTokPageInfo {
  page: number;
  page_size: number;
  total_number: number;
  total_page: number;
}

/** Campaign from TikTok API */
export interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  status?: string;
  budget?: string;
  budget_mode?: string;
  objective_type?: string;
}

/** Ad group from TikTok API */
export interface TikTokAdGroup {
  adgroup_id: string;
  adgroup_name: string;
  campaign_id?: string;
  status?: string;
  budget?: string;
  budget_mode?: string;
}

/** Ad from TikTok API */
export interface TikTokAd {
  ad_id: string;
  ad_name: string;
  adgroup_id?: string;
  status?: string;
  creative_id?: string;
}

/** Report row from TikTok report/integrated/get */
export interface TikTokReportRow {
  dimensions?: Record<string, string>;
  metrics?: Record<string, string | number>;
  campaign_id?: string;
  adgroup_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  conversion?: string;
  total_purchase_value?: string;
  [key: string]: unknown;
}

/** Parsed performance for one object */
export interface TikTokPerformance {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cpa: number;
}
