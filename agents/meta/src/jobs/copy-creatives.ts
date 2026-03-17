/**
 * Refresh ad copy/creatives using Claude. Reads existing creative, generates new copy, creates new creative, updates ad.
 */

import type { ClaudeClient } from "core";
import type { MetaApiClient } from "../api.js";
import type { MetaAd, MetaAdCreative } from "../types.js";
import type { ReportAction } from "core";

const MAX_ADS_TO_UPDATE = 10;

export interface CopyCreativesResult {
  actions: ReportAction[];
}

function parseObjectStorySpec(spec: string | Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (spec == null) return null;
  if (typeof spec === "object") return spec;
  try {
    return JSON.parse(spec) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function runCopyCreatives(
  api: MetaApiClient,
  accountId: string,
  claude: ClaudeClient,
  options: {
    reportAction: (p: { action: string; targetId?: string; targetName?: string; details?: string }) => ReportAction;
    logger: { info: (msg: string, ctx?: Record<string, unknown>) => void };
  }
): Promise<CopyCreativesResult> {
  const actions: ReportAction[] = [];
  const campaigns = await api.getCampaigns(accountId, { withInsights: false });
  let adsProcessed = 0;

  for (const campaign of campaigns) {
    if (adsProcessed >= MAX_ADS_TO_UPDATE) break;
    if (campaign.status !== "ACTIVE") continue;

    const adSets = await api.getAdSets(campaign.id, { withInsights: false });
    for (const adSet of adSets) {
      if (adsProcessed >= MAX_ADS_TO_UPDATE) break;
      if (adSet.status !== "ACTIVE") continue;

      const ads = await api.getAds(adSet.id, { withInsights: false });
      for (const ad of ads as MetaAd[]) {
        if (adsProcessed >= MAX_ADS_TO_UPDATE) break;
        if (ad.status !== "ACTIVE" || !ad.creative?.id) continue;

        const creativeId = typeof ad.creative === "object" ? ad.creative.id : String(ad.creative);
        let creative: MetaAdCreative;
        try {
          creative = await api.getAdCreative(creativeId);
        } catch {
          continue;
        }

        const body = creative.body ?? creative.title ?? "";
        if (!body.trim()) continue;

        const context = `Ad: ${ad.name}. Current copy: ${body.slice(0, 300)}`;
        let newCopy: string;
        try {
          newCopy = await claude.generateCopy(
            { context, currentCopy: body, tone: "short, CTA-focused" },
            { maxTokens: 256 }
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          options.logger.info(`Claude copy failed for ad ${ad.id}: ${msg}`);
          continue;
        }

        newCopy = newCopy.trim().slice(0, 125);
        if (!newCopy) continue;

        const spec = parseObjectStorySpec(creative.object_story_spec);
        if (!spec) continue;

        const updatedSpec = cloneSpecWithNewMessage(spec, newCopy);
        if (!updatedSpec) continue;

        try {
          const { id: newCreativeId } = await api.createAdCreative(accountId, {
            name: `${creative.name ?? "Creative"}-refreshed-${Date.now()}`,
            object_story_spec: updatedSpec,
          });
          await api.updateAdCreative(ad.id, newCreativeId);
          adsProcessed += 1;
          actions.push(
            options.reportAction({
              action: "Updated ad creative (new copy)",
              targetId: ad.id,
              targetName: ad.name,
              details: `new copy: ${newCopy.slice(0, 60)}...`,
            })
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          actions.push(
            options.reportAction({
              action: "Failed to update ad creative",
              targetId: ad.id,
              targetName: ad.name,
              details: msg,
            })
          );
        }
      }
    }
  }

  return { actions };
}

function cloneSpecWithNewMessage(
  spec: Record<string, unknown>,
  message: string
): Record<string, unknown> | null {
  const linkData = spec.link_data as Record<string, unknown> | undefined;
  if (linkData && typeof linkData === "object") {
    return {
      ...spec,
      link_data: { ...linkData, message },
    };
  }
  const videoData = spec.video_data as Record<string, unknown> | undefined;
  if (videoData && typeof videoData === "object") {
    return {
      ...spec,
      video_data: { ...videoData, message },
    };
  }
  if (spec.page_id) {
    return { ...spec, message } as Record<string, unknown>;
  }
  return null;
}
