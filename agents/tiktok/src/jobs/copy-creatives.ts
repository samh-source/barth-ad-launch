/**
 * Refresh ad copy using Claude. Reads current ad text, generates new copy, updates ad.
 */

import type { ClaudeClient } from "core";
import type { TikTokApiClient } from "../api.js";
import type { TikTokAd } from "../types.js";
import type { ReportAction } from "core";

const MAX_ADS_TO_UPDATE = 10;

export interface CopyCreativesResult {
  actions: ReportAction[];
}

export async function runCopyCreatives(
  api: TikTokApiClient,
  advertiserId: string,
  claude: ClaudeClient,
  options: {
    reportAction: (p: { action: string; targetId?: string; targetName?: string; details?: string }) => ReportAction;
    logger: { info: (msg: string) => void };
  }
): Promise<CopyCreativesResult> {
  const actions: ReportAction[] = [];
  const campaigns = await api.getCampaigns(advertiserId);
  let adsProcessed = 0;

  for (const campaign of campaigns) {
    if (adsProcessed >= MAX_ADS_TO_UPDATE) break;
    if (campaign.status !== "ENABLE" && campaign.status !== "ACTIVE") continue;

    const adGroups = await api.getAdGroups(advertiserId, campaign.campaign_id);
    for (const ag of adGroups) {
      if (adsProcessed >= MAX_ADS_TO_UPDATE) break;
      if (ag.status !== "ENABLE" && ag.status !== "ACTIVE") continue;

      const ads = await api.getAds(advertiserId, ag.adgroup_id);
      for (const ad of ads as TikTokAd[]) {
        if (adsProcessed >= MAX_ADS_TO_UPDATE) break;
        if (ad.status !== "ENABLE" && ad.status !== "ACTIVE") continue;

        let currentText = "";
        if (ad.creative_id) {
          try {
            const creative = await api.getCreative(advertiserId, ad.creative_id);
            currentText = creative.ad_text ?? "";
          } catch {
            continue;
          }
        }
        if (!currentText.trim()) continue;

        const context = `TikTok ad: ${ad.ad_name}. Current copy: ${currentText.slice(0, 300)}`;
        let newCopy: string;
        try {
          newCopy = await claude.generateCopy(
            { context, currentCopy: currentText, tone: "short, punchy, CTA-focused" },
            { maxTokens: 256 }
          );
        } catch (err) {
          options.logger.info(`Claude copy failed for ad ${ad.ad_id}: ${err}`);
          continue;
        }

        newCopy = newCopy.trim().slice(0, 150);
        if (!newCopy) continue;

        try {
          await api.updateAdCreative(advertiserId, ad.ad_id, { ad_text: newCopy });
          adsProcessed += 1;
          actions.push(
            options.reportAction({
              action: "Updated ad copy",
              targetId: ad.ad_id,
              targetName: ad.ad_name,
              details: `new copy: ${newCopy.slice(0, 60)}...`,
            })
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          actions.push(
            options.reportAction({
              action: "Failed to update ad copy",
              targetId: ad.ad_id,
              targetName: ad.ad_name,
              details: msg,
            })
          );
        }
      }
    }
  }

  return { actions };
}
