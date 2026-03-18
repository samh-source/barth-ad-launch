/**
 * Barth Meta launch: upload video, generate caption with Claude, create campaign with $50/day budget, stream status.
 */

import { loadClientsWithMeta, createClaudeClient } from "core";
import { join } from "node:path";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const DAILY_BUDGET_CENTS = 5000; // $50/day

export interface BarthMetaLaunchOptions {
  projectRoot: string;
  videoBuffer: Buffer;
  videoFileName: string;
  clientIds: string[];
  brief?: string;
  onStatus: (message: string) => void;
}

function normAccountId(id: string): string {
  return id.replace(/^act_/, "");
}

async function parseJsonRes(res: Response): Promise<unknown> {
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to read response body (${res.status}): ${errMsg}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.length > 120 ? text.slice(0, 120) + "…" : text;
    throw new Error(`Server returned non-JSON (${res.status}): ${snippet}`);
  }
}

export async function runBarthMetaLaunch(options: BarthMetaLaunchOptions): Promise<void> {
  const { projectRoot, videoBuffer, videoFileName, clientIds, brief, onStatus } = options;
  const clientsDir = join(projectRoot, "config", "clients");

  const { clients, errors } = await loadClientsWithMeta({ clientsDir });
  if (errors.length > 0) {
    onStatus(`Barth: Config warnings: ${errors.map((e) => e.file).join(", ")}`);
  }

  const metaClients = clients.filter((c) => clientIds.includes(c.metaAccountId));
  if (metaClients.length === 0) {
    onStatus("Barth: No valid Meta clients selected.");
    return;
  }

  const claude = createClaudeClient();
  const dateStr = new Date().toISOString().slice(0, 10);

  const defaultTargeting = { geo_locations: { countries: ["US"] as string[] } };

  for (const client of metaClients) {
    const { clientName, metaAccountId, metaAccessToken, metaPageId } = client;
    const metaWebsiteUrl = (client as { metaWebsiteUrl?: string }).metaWebsiteUrl?.trim();
    const metaTargeting = (client as { metaTargeting?: { geo_locations?: { countries?: string[]; custom_locations?: Array<{ latitude: number; longitude: number; radius?: number; distance_unit?: string }> } } }).metaTargeting;
    const accountId = normAccountId(metaAccountId);

    if (!metaPageId?.trim()) {
      onStatus(`Barth: Skipping ${clientName} — metaPageId required for video ads. Add metaPageId to config.`);
      continue;
    }

    const targeting =
      metaTargeting?.geo_locations &&
      (metaTargeting.geo_locations.countries?.length || metaTargeting.geo_locations.custom_locations?.length)
        ? {
            geo_locations: {
              ...(metaTargeting.geo_locations.countries?.length
                ? { countries: metaTargeting.geo_locations.countries }
                : {}),
              ...(metaTargeting.geo_locations.custom_locations?.length
                ? {
                    custom_locations: metaTargeting.geo_locations.custom_locations.map((loc) => ({
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                      radius: loc.radius ?? 10,
                      distance_unit: loc.distance_unit ?? "mile",
                    })),
                  }
                : {}),
            },
          }
        : defaultTargeting;
    const gl = targeting.geo_locations as { countries?: string[]; custom_locations?: unknown[] };
    if (gl.custom_locations?.length && !gl.countries?.length) {
      gl.countries = ["US"];
    }

    try {
      onStatus(`Barth: Starting launch for ${clientName}…`);

      // 1) Upload video to ad account
      const form = new FormData();
      form.append("access_token", metaAccessToken);
      const blob = new Blob([videoBuffer], { type: "video/mp4" });
      form.append("source", blob, videoFileName);

      const uploadUrl = `${GRAPH_BASE}/act_${accountId}/advideos`;
      const uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
      const uploadData = (await parseJsonRes(uploadRes)) as { id?: string; error?: { message: string } };
      if (!uploadRes.ok || uploadData.error) {
        throw new Error(uploadData.error?.message ?? `Upload HTTP ${uploadRes.status}`);
      }
      const videoId = uploadData.id;
      if (!videoId) throw new Error("No video id returned");
      onStatus(`Barth: Uploaded video for ${clientName} (${videoId}).`);

      // 1b) Upload thumbnail image for video_data (Meta requires image_hash or image_url)
      const thumbPngB64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const thumbForm = new FormData();
      thumbForm.append("access_token", metaAccessToken);
      thumbForm.append("bytes", thumbPngB64);
      thumbForm.append("name", "thumb.png");
      const thumbRes = await fetch(`${GRAPH_BASE}/act_${accountId}/adimages`, { method: "POST", body: thumbForm });
      const thumbData = (await parseJsonRes(thumbRes)) as { images?: Record<string, { hash?: string }>; error?: { message: string } };
      if (!thumbRes.ok || thumbData.error) {
        throw new Error(thumbData.error?.message ?? `Thumbnail upload HTTP ${thumbRes.status}`);
      }
      const firstImage = thumbData.images && Object.values(thumbData.images)[0];
      const imageHash = firstImage?.hash;
      if (!imageHash) throw new Error("No image_hash from thumbnail upload");

      // 2) Generate caption with Claude
      const context = brief?.trim()
        ? `${clientName}. Brief: ${brief}`
        : clientName;
      const caption = await claude.generateCopy({
        context,
        tone: "short, CTA-focused",
      });
      const message = (caption || "").trim().slice(0, 125) || `${clientName} — watch now`;
      onStatus(`Barth: Generated caption for ${clientName}.`);

      // 3) Create campaign with Advantage campaign budget ($50/day at campaign level so we don't need is_adset_budget_sharing_enabled on ad set)
      const campaignName = `Barth – ${clientName} – ${dateStr}`;
      const campaignRes = await fetch(`${GRAPH_BASE}/act_${accountId}/campaigns?access_token=${encodeURIComponent(metaAccessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: campaignName,
          objective: "OUTCOME_ENGAGEMENT",
          status: "ACTIVE",
          daily_budget: String(DAILY_BUDGET_CENTS),
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          special_ad_categories: "NONE",
        }).toString(),
      });
      const campaignData = (await parseJsonRes(campaignRes)) as { id?: string; error?: { message: string; error_user_msg?: string } };
      if (!campaignRes.ok || campaignData.error) {
        const errMsg = campaignData.error?.error_user_msg ?? campaignData.error?.message ?? `Campaign HTTP ${campaignRes.status}`;
        throw new Error(errMsg);
      }
      const campaignId = campaignData.id;
      if (!campaignId) throw new Error("No campaign id returned");
      onStatus(`Barth: Created campaign for ${clientName} (${campaignId}).`);

      // 4) Create ad set (OUTCOME_ENGAGEMENT requires destination_type + matching optimization_goal; ON_POST allows POST_ENGAGEMENT)
      const adSetName = `Barth – ${clientName} – ad set – ${dateStr}`;
      const adSetBody = new URLSearchParams({
        name: adSetName,
        campaign_id: campaignId,
        billing_event: "IMPRESSIONS",
        optimization_goal: "POST_ENGAGEMENT",
        destination_type: "ON_POST",
        promoted_object: JSON.stringify({ page_id: metaPageId }),
        targeting: JSON.stringify(targeting),
        status: "ACTIVE",
      });
      const adSetRes = await fetch(`${GRAPH_BASE}/act_${accountId}/adsets?access_token=${encodeURIComponent(metaAccessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: adSetBody.toString(),
      });
      const adSetData = (await parseJsonRes(adSetRes)) as { id?: string; error?: { message: string; error_user_msg?: string } };
      if (!adSetRes.ok || adSetData.error) {
        const errMsg = adSetData.error?.error_user_msg ?? adSetData.error?.message ?? `Ad set HTTP ${adSetRes.status}`;
        throw new Error(errMsg);
      }
      const adSetId = adSetData.id;
      if (!adSetId) throw new Error("No ad set id returned");
      onStatus(`Barth: Created ad set for ${clientName} ($${DAILY_BUDGET_CENTS / 100}/day).`);

      // 5) Create video ad creative. Only attach an external CTA when a real website URL is configured.
      const creativeName = `Barth – ${clientName} – creative – ${dateStr}`;
      const videoData: {
        video_id: string;
        message: string;
        image_hash: string;
        call_to_action?: {
          type: string;
          value: { link: string };
        };
      } = {
        video_id: videoId,
        message,
        image_hash: imageHash,
      };
      if (metaWebsiteUrl) {
        videoData.call_to_action = {
          type: "LEARN_MORE",
          value: { link: metaWebsiteUrl },
        };
      }
      const creativeRes = await fetch(`${GRAPH_BASE}/act_${accountId}/adcreatives?access_token=${encodeURIComponent(metaAccessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creativeName,
          object_story_spec: {
            page_id: metaPageId,
            video_data: videoData,
          },
        }),
      });
      const creativeData = (await parseJsonRes(creativeRes)) as { id?: string; error?: { message: string; error_user_msg?: string } };
      if (!creativeRes.ok || creativeData.error) {
        const errMsg = creativeData.error?.error_user_msg ?? creativeData.error?.message ?? `Creative HTTP ${creativeRes.status}`;
        throw new Error(errMsg);
      }
      const creativeId = creativeData.id;
      if (!creativeId) throw new Error("No creative id returned");
      onStatus(`Barth: Created creative for ${clientName}.`);

      // 6) Create ad
      const adName = `Barth – ${clientName} – ad – ${dateStr}`;
      const adRes = await fetch(`${GRAPH_BASE}/act_${accountId}/ads?access_token=${encodeURIComponent(metaAccessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adName,
          adset_id: adSetId,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: "ACTIVE",
        }),
      });
      const adData = (await parseJsonRes(adRes)) as { id?: string; error?: { message: string; error_user_msg?: string } };
      if (!adRes.ok || adData.error) {
        const errMsg = adData.error?.error_user_msg ?? adData.error?.message ?? `Ad HTTP ${adRes.status}`;
        throw new Error(errMsg);
      }
      onStatus(`Barth: Launch complete for ${clientName}.`);
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      if (/Unexpected token|is not valid JSON/i.test(msg)) {
        msg = "API returned non-JSON (request may be too large or gateway error).";
      }
      onStatus(`Barth: Error for ${clientName} — ${msg}`);
    }
  }
}
