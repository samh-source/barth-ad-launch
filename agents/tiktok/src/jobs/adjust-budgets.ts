/**
 * Increase budget for strong-performing ad groups.
 */

import type { ClientThresholds } from "core";
import type { TikTokApiClient } from "../api.js";
import { getReportDateRange, parseReportRows } from "../api.js";
import type { ReportAction } from "core";

const DEFAULT_MIN_SPEND = 50;
const ROAS_BOOST_FACTOR = 1.2;
const BUDGET_INCREASE_PCT = 0.1;
const MAX_BUDGET_MULTIPLIER = 2;
const REPORT_DAYS = 7;

export interface AdjustBudgetsResult {
  actions: ReportAction[];
}

function parseBudget(b: string | undefined): number {
  if (b == null || b === "") return 0;
  const n = parseFloat(String(b));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function runAdjustBudgets(
  api: TikTokApiClient,
  advertiserId: string,
  thresholds: ClientThresholds | undefined,
  options: {
    reportAction: (p: { action: string; targetId?: string; targetName?: string; details?: string }) => ReportAction;
  }
): Promise<AdjustBudgetsResult> {
  const actions: ReportAction[] = [];
  const minSpend = thresholds?.minSpendToEvaluate ?? DEFAULT_MIN_SPEND;
  const minROAS = thresholds?.minROAS ?? 0;
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

      const currentBudget = parseBudget(ag.budget);
      if (currentBudget <= 0) continue;

      const perf = perfMap.get(ag.adgroup_id);
      if (!perf || perf.spend < minSpend) continue;

      const roasThreshold = minROAS * ROAS_BOOST_FACTOR;
      if (perf.roas < roasThreshold) continue;

      const newBudget = Math.min(
        Math.round(currentBudget * (1 + BUDGET_INCREASE_PCT)),
        currentBudget * MAX_BUDGET_MULTIPLIER
      );
      if (newBudget <= currentBudget) continue;

      try {
        await api.updateAdGroupBudget(advertiserId, ag.adgroup_id, newBudget);
        actions.push(
          options.reportAction({
            action: "Increased ad group budget",
            targetId: ag.adgroup_id,
            targetName: ag.adgroup_name,
            details: `budget ${currentBudget} → ${newBudget} (ROAS ${perf.roas.toFixed(2)})`,
          })
        );
      } catch {
        actions.push(
          options.reportAction({
            action: "Failed to update ad group budget",
            targetId: ag.adgroup_id,
            targetName: ag.adgroup_name,
            details: "API error",
          })
        );
      }
    }
  }

  return { actions };
}
