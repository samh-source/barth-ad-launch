/**
 * Pause campaigns, ad sets, or ads that fall below performance thresholds.
 * Evaluates at ad set level (pauses entire ad set if it underperforms).
 */

import type { ClientThresholds } from "core";
import type { MetaApiClient } from "../api.js";
import { parseInsights } from "../api.js";
import type { MetaAdSet } from "../types.js";
import type { ReportAction } from "core";

const DEFAULT_MIN_SPEND = 50;
const DEFAULT_MIN_CONVERSIONS = 1;

export interface PauseUnderperformersResult {
  actions: ReportAction[];
  pausedAdSetIds: string[];
}

function shouldPause(
  spend: number,
  conversions: number,
  roas: number,
  cpa: number,
  thresholds: ClientThresholds | undefined
): boolean {
  const minSpend = thresholds?.minSpendToEvaluate ?? DEFAULT_MIN_SPEND;
  const minConversions = thresholds?.minConversionsToEvaluate ?? DEFAULT_MIN_CONVERSIONS;
  if (spend < minSpend) return false;
  if (conversions < minConversions && (thresholds?.minROAS == null) && (thresholds?.maxCPA == null))
    return false;
  if (thresholds?.minROAS != null && roas < thresholds.minROAS && spend >= minSpend) return true;
  if (thresholds?.maxCPA != null && conversions >= minConversions && cpa > thresholds.maxCPA)
    return true;
  return false;
}

export async function runPauseUnderperformers(
  api: MetaApiClient,
  accountId: string,
  thresholds: ClientThresholds | undefined,
  options: {
    reportAction: (p: { action: string; targetId?: string; targetName?: string; details?: string }) => ReportAction;
  }
): Promise<PauseUnderperformersResult> {
  const actions: ReportAction[] = [];
  const pausedAdSetIds: string[] = [];

  const campaigns = await api.getCampaigns(accountId, { withInsights: true });
  for (const campaign of campaigns) {
    if (campaign.status !== "ACTIVE") continue;

    const adSets = await api.getAdSets(campaign.id, { withInsights: true });
    for (const adSet of adSets as MetaAdSet[]) {
      if (adSet.status !== "ACTIVE") continue;

      const perf = parseInsights(adSet.id, adSet.name, adSet.insights);
      const pause = shouldPause(
        perf.spend,
        perf.conversions,
        perf.roas,
        perf.cpa,
        thresholds
      );
      if (!pause) continue;

      try {
        await api.pauseAdSet(adSet.id);
        pausedAdSetIds.push(adSet.id);
        actions.push(
          options.reportAction({
            action: "Paused ad set (underperforming)",
            targetId: adSet.id,
            targetName: adSet.name,
            details: `spend=${perf.spend.toFixed(2)} roas=${perf.roas.toFixed(2)} cpa=${perf.cpa.toFixed(2)}`,
          })
        );
      } catch {
        actions.push(
          options.reportAction({
            action: "Failed to pause ad set",
            targetId: adSet.id,
            targetName: adSet.name,
            details: "API error",
          })
        );
      }
    }
  }

  return { actions, pausedAdSetIds };
}
