/**
 * Meta Marketing API client: campaigns, ad sets, ads, insights, pause, budget, creatives.
 */

import type {
  MetaAd,
  MetaAdCreative,
  MetaAdSet,
  MetaCampaign,
  MetaInsightsRow,
} from "./types.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const INSIGHTS_PRESET = "last_7d";
const INSIGHTS_FIELDS = "spend,impressions,actions";
const DEFAULT_LIMIT = "500";

export interface MetaApiClientOptions {
  accessToken: string;
}

function parseNumber(s: string | undefined): number {
  if (s == null || s === "") return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

/** Extract conversions count and value from insights actions (purchase, offsite_conversion.fb_pixel_purchase, etc.) */
function getConversionsFromActions(actions: MetaInsightsRow["actions"]): { count: number; value: number } {
  let count = 0;
  let value = 0;
  if (!Array.isArray(actions)) return { count, value };
  const purchaseTypes = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];
  for (const a of actions) {
    const type = (a.action_type || "").toLowerCase();
    if (purchaseTypes.some((p) => type.includes("purchase") || type === p)) {
      count += 1;
      value += parseNumber(a.value);
    }
  }
  return { count, value };
}

export function createMetaApiClient(options: MetaApiClientOptions) {
  const { accessToken } = options;

  async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path.startsWith("http") ? path : `${GRAPH_BASE}/${path.replace(/^\//, "")}`);
    url.searchParams.set("access_token", accessToken);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString());
    const data = (await res.json()) as T & { error?: { message: string; type: string; code: number } };
    if (!res.ok || data.error) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Meta API ${path}: ${msg}`);
    }
    return data;
  }

  async function postForm(
    path: string,
    body: Record<string, string>
  ): Promise<{ success?: boolean; id?: string }> {
    const form: Record<string, string> = { ...body, access_token: accessToken };
    const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, "")}`);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const data = (await res.json()) as { success?: boolean; id?: string; error?: { message: string } };
    if (!res.ok || data.error) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Meta API POST ${path}: ${msg}`);
    }
    return data;
  }

  const accountIdNorm = (id: string) => id.replace(/^act_/, "") as string;

  return {
    async getAdAccount(accountId: string) {
      const id = accountIdNorm(accountId);
      return get<{ id: string; name?: string; account_id?: string; account_status?: number }>(
        `act_${id}`,
        { fields: "id,name,account_id,account_status" }
      );
    },

    async getCampaigns(accountId: string, options?: { withInsights?: boolean }) {
      const id = accountIdNorm(accountId);
      const fields =
        options?.withInsights !== false
          ? `id,name,status,daily_budget,lifetime_budget,objective,insights.date_preset(${INSIGHTS_PRESET}).fields(${INSIGHTS_FIELDS})`
          : "id,name,status,daily_budget,lifetime_budget,objective";
      const res = await get<{ data: MetaCampaign[]; paging?: { next?: string } }>(
        `act_${id}/campaigns`,
        { fields, limit: DEFAULT_LIMIT }
      );
      return res.data ?? [];
    },

    async getAdSets(campaignId: string, options?: { withInsights?: boolean }) {
      const fields =
        options?.withInsights !== false
          ? `id,name,status,campaign_id,daily_budget,lifetime_budget,insights.date_preset(${INSIGHTS_PRESET}).fields(${INSIGHTS_FIELDS})`
          : "id,name,status,campaign_id,daily_budget,lifetime_budget";
      const res = await get<{ data: MetaAdSet[]; paging?: { next?: string } }>(
        `${campaignId}/adsets`,
        { fields, limit: DEFAULT_LIMIT }
      );
      return res.data ?? [];
    },

    async getAds(adSetId: string, options?: { withInsights?: boolean }) {
      const fields =
        options?.withInsights !== false
          ? `id,name,status,adset_id,creative,insights.date_preset(${INSIGHTS_PRESET}).fields(${INSIGHTS_FIELDS})`
          : "id,name,status,adset_id,creative";
      const res = await get<{ data: MetaAd[]; paging?: { next?: string } }>(
        `${adSetId}/ads`,
        { fields, limit: DEFAULT_LIMIT }
      );
      return res.data ?? [];
    },

    async pauseCampaign(campaignId: string) {
      return postForm(campaignId, { status: "PAUSED" });
    },

    async pauseAdSet(adSetId: string) {
      return postForm(adSetId, { status: "PAUSED" });
    },

    async pauseAd(adId: string) {
      return postForm(adId, { status: "PAUSED" });
    },

    /** dailyBudget in cents (or account currency smallest unit) */
    async updateAdSetBudget(adSetId: string, dailyBudgetCents: number) {
      return postForm(adSetId, { daily_budget: String(dailyBudgetCents) });
    },

    async getAdCreative(creativeId: string): Promise<MetaAdCreative> {
      const fields = "id,name,body,title,object_story_spec,link_url,image_url";
      return get<MetaAdCreative>(creativeId, { fields });
    },

    /** Create ad creative with JSON object_story_spec. Returns new creative id. */
    async createAdCreative(
      accountId: string,
      params: { name: string; object_story_spec: Record<string, unknown> }
    ): Promise<{ id: string }> {
      const id = accountIdNorm(accountId);
      const url = new URL(`${GRAPH_BASE}/act_${id}/adcreatives`);
      url.searchParams.set("access_token", accessToken);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (!res.ok || data.error) {
        const msg = data.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`Meta API createAdCreative: ${msg}`);
      }
      if (!data.id) throw new Error("Meta API createAdCreative: no id in response");
      return { id: data.id };
    },

    /** Update an ad to use a different creative. */
    async updateAdCreative(adId: string, creativeId: string) {
      return postForm(adId, { creative: creativeId });
    },
  };
}

export type MetaApiClient = ReturnType<typeof createMetaApiClient>;

/** Helper: parse insights from a campaign/ad set/ad into spend, conversions, ROAS, CPA */
export function parseInsights(
  _id: string,
  _name: string,
  insights: MetaCampaign["insights"] | MetaAdSet["insights"] | MetaAd["insights"]
): { spend: number; impressions: number; conversions: number; conversionValue: number; roas: number; cpa: number } {
  const row: MetaInsightsRow = insights?.data?.[0] ?? {};
  const spend = parseNumber(row.spend);
  const impressions = parseNumber(row.impressions);
  const { count: conversions, value: conversionValue } = getConversionsFromActions(row.actions);
  const roas = spend > 0 ? conversionValue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  return {
    spend,
    impressions,
    conversions,
    conversionValue,
    roas,
    cpa,
  };
}
