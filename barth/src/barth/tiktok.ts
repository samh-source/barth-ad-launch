/**
 * Barth TikTok launch: upload video, generate copy, create campaign/ad group/ad, stream status.
 */

import { createClaudeClient, loadAllClients, type ClientConfig, type TikTokLaunchMode } from "core";
import { join } from "node:path";
import { getTikTokLaunchIssue } from "../launchReadiness.js";

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const DAILY_BUDGET = 50;

export interface BarthTikTokLaunchOptions {
  projectRoot: string;
  videoBuffer: Buffer;
  videoFileName: string;
  clientIds: string[];
  brief?: string;
  onStatus: (message: string) => void;
}

type TikTokPayload = Record<string, unknown> & {
  code?: number | string;
  message?: string;
  msg?: string;
  data?: unknown;
};

interface ReadyTikTokClient extends ClientConfig {
  tiktokAdvertiserId: string;
  tiktokAccessToken: string;
  tiktokLaunchMode: TikTokLaunchMode;
  tiktokLocationIds: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isSuccessPayload(payload: TikTokPayload): boolean {
  if (payload.code == null) return true;
  return String(payload.code) === "0";
}

function payloadMessage(payload: TikTokPayload, fallback: string): string {
  const nestedMessage =
    isObject(payload.data) && typeof payload.data.message === "string" ? payload.data.message : undefined;
  return nestedMessage ?? payload.message ?? payload.msg ?? fallback;
}

async function parseJsonRes(res: Response): Promise<TikTokPayload> {
  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read response body (${res.status}): ${message}`);
  }

  try {
    return JSON.parse(text) as TikTokPayload;
  } catch {
    const snippet = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    throw new Error(`TikTok returned non-JSON (${res.status}): ${snippet}`);
  }
}

async function postJson(
  accessToken: string,
  path: string,
  body: Record<string, unknown>
): Promise<TikTokPayload> {
  const res = await fetch(`${TIKTOK_BASE}${path}`, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJsonRes(res);
  if (!res.ok || !isSuccessPayload(payload)) {
    throw new Error(payloadMessage(payload, `TikTok HTTP ${res.status}`));
  }
  return payload;
}

async function postForm(
  accessToken: string,
  path: string,
  body: FormData
): Promise<TikTokPayload> {
  const res = await fetch(`${TIKTOK_BASE}${path}`, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
    },
    body,
  });
  const payload = await parseJsonRes(res);
  if (!res.ok || !isSuccessPayload(payload)) {
    throw new Error(payloadMessage(payload, `TikTok HTTP ${res.status}`));
  }
  return payload;
}

function readFirstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = readFirstString(item);
      if (nested) return nested;
    }
  }
  if (isObject(value)) {
    for (const key of ["id", "video_id", "campaign_id", "adgroup_id", "ad_id"]) {
      const nested = readFirstString(value[key]);
      if (nested) return nested;
    }
  }
  return undefined;
}

function getDataObject(payload: TikTokPayload): Record<string, unknown> {
  return isObject(payload.data) ? payload.data : {};
}

function extractId(payload: TikTokPayload, preferredKeys: string[]): string | undefined {
  const data = getDataObject(payload);
  for (const key of preferredKeys) {
    const direct = readFirstString(data[key]);
    if (direct) return direct;
  }
  return readFirstString(data);
}

function formatTikTokDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-") + ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

async function maybeRefreshAccessToken(
  client: ClientConfig,
  onStatus: (message: string) => void
): Promise<string> {
  const accessToken = client.tiktokAccessToken;
  if (!accessToken) {
    throw new Error("Missing TikTok access token.");
  }

  const refreshToken = client.tiktokRefreshToken?.trim();
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!refreshToken || !clientKey || !clientSecret) {
    return accessToken;
  }

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: clientKey,
        secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const payload = await parseJsonRes(res);
    if (!res.ok || !isSuccessPayload(payload)) {
      throw new Error(payloadMessage(payload, `TikTok auth HTTP ${res.status}`));
    }

    const data = getDataObject(payload);
    const refreshed = readFirstString(data.access_token);
    if (!refreshed) {
      throw new Error("Refresh succeeded but no access_token was returned.");
    }
    onStatus(`Barth: Refreshed TikTok token for ${client.clientName}.`);
    return refreshed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStatus(`Barth: TikTok token refresh failed for ${client.clientName}; using current token. ${message}`);
    return accessToken;
  }
}

function validateClient(client: ClientConfig): { ready?: ReadyTikTokClient; error?: string } {
  const issue = getTikTokLaunchIssue(client);
  if (issue) return { error: issue };
  return {
    ready: client as ReadyTikTokClient,
  };
}

async function uploadVideo(
  accessToken: string,
  advertiserId: string,
  videoBuffer: Buffer,
  videoFileName: string
): Promise<string> {
  const form = new FormData();
  form.append("advertiser_id", advertiserId);
  form.append("upload_type", "UPLOAD_BY_FILE");
  form.append("file_name", videoFileName);
  form.append("video_file", new Blob([videoBuffer], { type: "video/mp4" }), videoFileName);

  const payload = await postForm(accessToken, "/file/video/ad/upload/", form);
  const videoId = extractId(payload, ["video_id", "id"]);
  if (!videoId) throw new Error("TikTok video upload returned no video id.");
  return videoId;
}

async function createCampaign(
  accessToken: string,
  advertiserId: string,
  campaignName: string,
  mode: TikTokLaunchMode
): Promise<string> {
  const payload = await postJson(accessToken, "/campaign/create/", {
    advertiser_id: advertiserId,
    campaign_name: campaignName,
    objective_type: mode === "website_traffic" ? "TRAFFIC" : "REACH",
    operation_status: "ENABLE",
  });
  const campaignId = extractId(payload, ["campaign_id", "id"]);
  if (!campaignId) throw new Error("TikTok campaign creation returned no campaign id.");
  return campaignId;
}

async function createAdGroup(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  adgroupName: string,
  client: ReadyTikTokClient
): Promise<string> {
  const startTime = new Date(Date.now() + 5 * 60 * 1000);
  const body: Record<string, unknown> = {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    adgroup_name: adgroupName,
    budget_mode: "BUDGET_MODE_DAY",
    budget: DAILY_BUDGET,
    billing_event: client.tiktokLaunchMode === "website_traffic" ? "CPC" : "CPM",
    optimization_goal: client.tiktokLaunchMode === "website_traffic" ? "CLICK" : "REACH",
    pacing: "PACING_MODE_SMOOTH",
    schedule_type: "SCHEDULE_START",
    schedule_start_time: formatTikTokDateTime(startTime),
    placement_type: "PLACEMENT_TYPE_NORMAL",
    placements: ["PLACEMENT_TIKTOK"],
    location_ids: client.tiktokLocationIds,
    operation_status: "ENABLE",
  };
  const payload = await postJson(accessToken, "/adgroup/create/", body);
  const adgroupId = extractId(payload, ["adgroup_id", "id"]);
  if (!adgroupId) throw new Error("TikTok ad group creation returned no ad group id.");
  return adgroupId;
}

async function createAd(
  accessToken: string,
  advertiserId: string,
  adgroupId: string,
  adName: string,
  message: string,
  videoId: string,
  client: ReadyTikTokClient
): Promise<string> {
  const creative: Record<string, unknown> = {
    ad_name: adName,
    ad_text: message,
    video_id: videoId,
  };

  if (client.tiktokLaunchMode === "website_traffic" && client.tiktokWebsiteUrl) {
    creative.landing_page_url = client.tiktokWebsiteUrl;
    creative.call_to_action = "LEARN_MORE";
  }

  const payload = await postJson(accessToken, "/ad/create/", {
    advertiser_id: advertiserId,
    adgroup_id: adgroupId,
    creatives: [creative],
    operation_status: "ENABLE",
  });
  const adId = extractId(payload, ["ad_id", "id"]);
  if (!adId) throw new Error("TikTok ad creation returned no ad id.");
  return adId;
}

export async function runBarthTikTokLaunch(options: BarthTikTokLaunchOptions): Promise<void> {
  const { projectRoot, videoBuffer, videoFileName, clientIds, brief, onStatus } = options;
  const clientsDir = join(projectRoot, "config", "clients");

  const { clients, errors } = await loadAllClients({ clientsDir });
  if (errors.length > 0) {
    onStatus(`Barth: Config warnings: ${errors.map((e) => e.file).join(", ")}`);
  }

  const selectedClients = clients.filter((client) => clientIds.includes(client.clientName));
  if (selectedClients.length === 0) {
    onStatus("Barth: No valid TikTok clients selected.");
    return;
  }

  const claude = createClaudeClient();
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const client of selectedClients) {
    const validation = validateClient(client);
    if (!validation.ready) {
      onStatus(`Barth: Skipping ${client.clientName} for TikTok — ${validation.error}`);
      continue;
    }

    try {
      onStatus(`Barth: Starting TikTok launch for ${client.clientName}…`);
      const accessToken = await maybeRefreshAccessToken(client, onStatus);

      const videoId = await uploadVideo(
        accessToken,
        validation.ready.tiktokAdvertiserId,
        videoBuffer,
        videoFileName
      );
      onStatus(`Barth: Uploaded TikTok video for ${client.clientName} (${videoId}).`);

      const context = brief?.trim()
        ? `${client.clientName}. Brief: ${brief}`
        : `${client.clientName}. Platform: TikTok. Goal: ${validation.ready.tiktokLaunchMode}.`;
      const caption = await claude.generateCopy({
        context,
        tone: "short, CTA-focused",
      });
      const message = (caption || "").trim().slice(0, 100) || `${client.clientName} — learn more`;
      onStatus(`Barth: Generated TikTok caption for ${client.clientName}.`);

      const campaignName = `Barth - ${client.clientName} - TikTok - ${dateStr}`;
      const campaignId = await createCampaign(
        accessToken,
        validation.ready.tiktokAdvertiserId,
        campaignName,
        validation.ready.tiktokLaunchMode
      );
      onStatus(`Barth: Created TikTok campaign for ${client.clientName} (${campaignId}).`);

      const adgroupName = `Barth - ${client.clientName} - ad group - ${dateStr}`;
      const adgroupId = await createAdGroup(
        accessToken,
        validation.ready.tiktokAdvertiserId,
        campaignId,
        adgroupName,
        validation.ready
      );
      onStatus(`Barth: Created TikTok ad group for ${client.clientName} ($${DAILY_BUDGET}/day).`);

      const adName = `Barth - ${client.clientName} - ad - ${dateStr}`;
      const adId = await createAd(
        accessToken,
        validation.ready.tiktokAdvertiserId,
        adgroupId,
        adName,
        message,
        videoId,
        validation.ready
      );
      onStatus(`Barth: TikTok launch complete for ${client.clientName} (${adId}).`);
    } catch (err) {
      let message = err instanceof Error ? err.message : String(err);
      if (/Unexpected token|is not valid JSON/i.test(message)) {
        message = "TikTok returned a non-JSON response.";
      }
      onStatus(`Barth: TikTok error for ${client.clientName} — ${message}`);
    }
  }
}
