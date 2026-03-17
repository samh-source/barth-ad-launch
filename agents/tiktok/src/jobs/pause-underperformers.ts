/**
 * Pause ad groups (and optionally campaigns) that fall below performance thresholds.
 */

import type { ClientThresholds } from "core";
import type { TikTokApiClient } from "../api.js";
import { getReportDateRange, parseReportRows } from "../api.js";
import type { ReportAction } from "core";

const DEFAULT_MIN_SPEND = 50;
const DEFAULT_MIN_CONVERSIONS = 1;
const REPORT_DAYS = 7;

export interface PauseUnderperformersResult {
  actions: ReportAction[];
  pausedAdGroupIds: string[];
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
  if (conversions < minConversions && thresholds?.minROAS == null && thresholds?.maxCPA == null)
    return false;
  if (thresholds?.minROAS != null && roas < thresholds.minROAS && spend >= minSpend) return true;
  if (thresholds?.maxCPA != null && conversions >= minConversions && cpa > thresholds.maxCPA)
    return true;
  return false;
}

export async function runPauseUnderperformers(
  api: TikTokApiClient,
  advertiserId: string,
  thresholds: ClientThresholds | undefined,
  options: {
    reportAction: (p: { action: string; targetId?: string; targetName?: string; details?: string }) => ReportAction;
  }
): Promise<PauseUnderperformersResult> {
  const actions: ReportAction[] = [];
  const pausedAdGroupIds: string[] = [];
  const { startDate, endDate } = getReportDateRange(REPORT_DAYS);

  const reportRows = await api.getReport(advertiserId, {
    dataLevel: "AUCTION_ADGROUP",
    startDate,
    endDate,
  });
  const perfMap = parseReportRows(reportRows, "adgroup_id", "adgroup_name");

  const campaigns = await api.getCampaigns(advertiserId);
  for (const campaign of campaigns) {
    if (campaign.status !== "ENABLE" && campaign.status !== "ACTIVE") continue;

    const adGroups = await api.getAdGroups(advertiserId, campaign.campaign_id);
    for (const ag of adGroups) {
      if (ag.status !== "ENABLE" && ag.status !== "ACTIVE") continue;

      const perf = perfMap.get(ag.adgroup_id);
      if (!perf) continue;

      const pause = shouldPause(
        perf.spend,
        perf.conversions,
        perf.roas,
        perf.cpa,
        thresholds
      );
      if (!pause) continue;

      try {
        await api.pauseAdGroup(advertiserId, ag.adgroup_id);
        pausedAdGroupIds.push(ag.adgroup_id);
        actions.push(
          options.reportAction({
            action: "Paused ad group (underperforming)",
            targetId: ag.adgroup_id,
            targetName: ag.adgroup_name,
            details: `spend=${perf.spend.toFixed(2)} roas=${perf.roas.toFixed(2)} cpa=${perf.cpa.toFixed(2)}`,
          })
        );
      } catch {
        actions.push(
          options.reportAction({
            action: "Failed to pause ad group",
            targetId: ag.adgroup_id,
            targetName: ag.adgroup_name,
            details: "API error",
          })
        );
      }
    }
  }

  return { actions, pausedAdGroupIds };
}
