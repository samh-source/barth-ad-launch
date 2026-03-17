/**
 * TikTok Marketing API client: campaigns, ad groups, ads, report, pause, budget, creatives.
 */

import type {
  TikTokAd,
  TikTokAdGroup,
  TikTokApiResponse,
  TikTokCampaign,
  TikTokPageInfo,
  TikTokPerformance,
  TikTokReportRow,
} from "./types.js";

const API_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const REPORT_BASE = "https://business-api.tiktok.com/open_api/v1.2";
const PAGE_SIZE = 1000;

export interface TikTokApiClientOptions {
  accessToken: string;
}

function parseNum(s: string | number | undefined): number {
  if (s == null) return 0;
  const n = typeof s === "number" ? s : parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

export function createTikTokApiClient(options: TikTokApiClientOptions) {
  const { accessToken } = options;

  async function get<T>(url: string, params?: Record<string, string>): Promise<T> {
    const u = new URL(url.startsWith("http") ? url : `${API_BASE}/${url.replace(/^\//, "")}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        u.searchParams.set(k, v);
      }
    }
    const res = await fetch(u.toString(), {
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    const data = (await res.json()) as TikTokApiResponse<T> & { code?: number; message?: string };
    if (data.code !== 0 && data.code !== 200) {
      const msg = data.message ?? `HTTP ${res.status}`;
      throw new Error(`TikTok API: ${msg}`);
    }
    return data as T;
  }

  async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const u = url.startsWith("http") ? url : `${API_BASE}/${url.replace(/^\//, "")}`;
    const res = await fetch(u, {
      method: "POST",
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as TikTokApiResponse<T> & { code?: number; message?: string };
    if (data.code !== 0 && data.code !== 200) {
      const msg = data.message ?? `HTTP ${res.status}`;
      throw new Error(`TikTok API: ${msg}`);
    }
    return data as T;
  }

  return {
    async getCampaigns(advertiserId: string): Promise<TikTokCampaign[]> {
      const out: TikTokCampaign[] = [];
      let page = 1;
      for (;;) {
        const res = await get<{ list?: TikTokCampaign[]; page_info?: TikTokPageInfo }>(
          `${API_BASE}/campaign/get/`,
          {
            advertiser_id: advertiserId,
            page: String(page),
            page_size: String(PAGE_SIZE),
          }
        );
        const list = (res as { list?: TikTokCampaign[] }).list ?? [];
        out.push(...list);
        const pageInfo = (res as { page_info?: TikTokPageInfo }).page_info;
        if (!pageInfo || page >= pageInfo.total_page) break;
        page += 1;
      }
      return out;
    },

    async getAdGroups(advertiserId: string, campaignId: string): Promise<TikTokAdGroup[]> {
      const out: TikTokAdGroup[] = [];
      let page = 1;
      for (;;) {
        const res = await get<{ list?: TikTokAdGroup[]; page_info?: TikTokPageInfo }>(
          `${API_BASE}/adgroup/get/`,
          {
            advertiser_id: advertiserId,
            campaign_id: campaignId,
            page: String(page),
            page_size: String(PAGE_SIZE),
          }
        );
        const list = (res as { list?: TikTokAdGroup[] }).list ?? [];
        out.push(...list);
        const pageInfo = (res as { page_info?: TikTokPageInfo }).page_info;
        if (!pageInfo || page >= pageInfo.total_page) break;
        page += 1;
      }
      return out;
    },

    async getAds(advertiserId: string, adGroupId: string): Promise<TikTokAd[]> {
      const out: TikTokAd[] = [];
      let page = 1;
      for (;;) {
        const res = await get<{ list?: TikTokAd[]; page_info?: TikTokPageInfo }>(
          `${API_BASE}/ad/get/`,
          {
            advertiser_id: advertiserId,
            adgroup_id: adGroupId,
            page: String(page),
            page_size: String(PAGE_SIZE),
          }
        );
        const list = (res as { list?: TikTokAd[] }).list ?? [];
        out.push(...list);
        const pageInfo = (res as { page_info?: TikTokPageInfo }).page_info;
        if (!pageInfo || page >= pageInfo.total_page) break;
        page += 1;
      }
      return out;
    },

    /** Get integrated report. data_level: AUCTION_CAMPAIGN | AUCTION_ADGROUP | AUCTION_AD */
    async getReport(
      advertiserId: string,
      options: {
        dataLevel: "AUCTION_CAMPAIGN" | "AUCTION_ADGROUP" | "AUCTION_AD";
        startDate: string;
        endDate: string;
      }
    ): Promise<TikTokReportRow[]> {
      const dims =
        options.dataLevel === "AUCTION_CAMPAIGN"
          ? ["campaign_id"]
          : options.dataLevel === "AUCTION_ADGROUP"
            ? ["campaign_id", "adgroup_id"]
            : ["campaign_id", "adgroup_id", "ad_id"];
      const metrics = ["spend", "impressions", "conversion", "total_purchase_value"];
      const body = {
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: options.dataLevel,
        dimensions: dims,
        metrics,
        start_date: options.startDate,
        end_date: options.endDate,
      };
      const res = await post<{ list?: TikTokReportRow[]; data?: { list?: TikTokReportRow[] } }>(
        `${REPORT_BASE}/report/integrated/get/`,
        body
      );
      const list = (res as { data?: { list?: TikTokReportRow[] } }).data?.list ?? (res as { list?: TikTokReportRow[] }).list;
      return list ?? [];
    },

    async pauseCampaign(advertiserId: string, campaignId: string) {
      return post(`${API_BASE}/campaign/status/update/`, {
        advertiser_id: advertiserId,
        campaign_ids: JSON.stringify([campaignId]),
        opt_status: "DISABLE",
      });
    },

    async pauseAdGroup(advertiserId: string, adGroupId: string) {
      return post(`${API_BASE}/adgroup/status/update/`, {
        advertiser_id: advertiserId,
        adgroup_ids: JSON.stringify([adGroupId]),
        opt_status: "DISABLE",
      });
    },

    async updateAdGroupBudget(
      advertiserId: string,
      adGroupId: string,
      budgetAmount: number
    ) {
      return post(`${API_BASE}/adgroup/update/`, {
        advertiser_id: advertiserId,
        adgroup_id: adGroupId,
        budget: String(budgetAmount),
      });
    },

    async getCreative(advertiserId: string, creativeId: string): Promise<{ ad_name?: string; ad_text?: string }> {
      const res = await get<{ list?: { ad_name?: string; ad_text?: string }[] }>(
        `${API_BASE}/creative/get/`,
        { advertiser_id: advertiserId, creative_ids: JSON.stringify([creativeId]) }
      );
      const list = (res as { list?: { ad_text?: string }[] }).list;
      return list?.[0] ?? {};
    },

    /** Update ad creative (ad text). TikTok may support ad/update with creative or ad_text. */
    async updateAdCreative(
      advertiserId: string,
      adId: string,
      params: { ad_name?: string; ad_text?: string }
    ) {
      return post(`${API_BASE}/ad/update/`, {
        advertiser_id: advertiserId,
        ad_id: adId,
        ...params,
      });
    },
  };
}

export type TikTokApiClient = ReturnType<typeof createTikTokApiClient>;

/** Date range for last N days in YYYYMMDD */
export function getReportDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const f = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: f(start), endDate: f(end) };
}

/** Map report rows to performance by id. */
export function parseReportRows(
  rows: TikTokReportRow[],
  idKey: "campaign_id" | "adgroup_id" | "ad_id",
  nameKey: string
): Map<string, TikTokPerformance> {
  const map = new Map<string, TikTokPerformance>();
  for (const row of rows) {
    const id = row.dimensions?.[idKey] ?? row[idKey] as string | undefined;
    if (!id) continue;
    const name = (row.dimensions?.[nameKey] ?? row[nameKey] ?? id) as string;
    const spend = parseNum(row.spend ?? row.metrics?.spend);
    const impressions = parseNum(row.impressions ?? row.metrics?.impressions);
    const conversions = parseNum(row.conversion ?? row.metrics?.conversion);
    const conversionValue = parseNum(row.total_purchase_value ?? row.metrics?.total_purchase_value);
    const roas = spend > 0 ? conversionValue / spend : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    map.set(id, {
      id,
      name,
      spend,
      impressions,
      conversions,
      conversionValue,
      roas,
      cpa,
    });
  }
  return map;
}
