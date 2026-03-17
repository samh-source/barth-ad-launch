/**
 * Adjust ad set budgets: increase for strong performers, optionally decrease for weak (or leave to pause job).
 */

import type { ClientThresholds } from "core";
import type { MetaApiClient } from "../api.js";
import { parseInsights } from "../api.js";
import type { MetaAdSet } from "../types.js";
import type { ReportAction } from "core";

const DEFAULT_MIN_SPEND = 50;
const ROAS_BOOST_FACTOR = 1.2;
const BUDGET_INCREASE_PCT = 0.1;
const MAX_BUDGET_MULTIPLIER = 2;

export interface AdjustBudgetsResult {
  actions: ReportAction[];
}

function parseBudget(b: string | undefined): number {
  if (b == null || b === "") return 0;
  const n = parseFloat(String(b));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function runAdjustBudgets(
  api: MetaApiClient,
  accountId: string,
  thresholds: ClientThresholds | undefined,
  options: {
    reportAction: (p: { action: string; targetId?: string; targetName?: string; details?: string }) => ReportAction;
  }
): Promise<AdjustBudgetsResult> {
  const actions: ReportAction[] = [];
  const minSpend = thresholds?.minSpendToEvaluate ?? DEFAULT_MIN_SPEND;
  const minROAS = thresholds?.minROAS ?? 0;

  const campaigns = await api.getCampaigns(accountId, { withInsights: true });
  for (const campaign of campaigns) {
    if (campaign.status !== "ACTIVE") continue;

    const adSets = await api.getAdSets(campaign.id, { withInsights: true });
    for (const adSet of adSets as MetaAdSet[]) {
      if (adSet.status !== "ACTIVE") continue;

      const currentBudget = parseBudget(adSet.daily_budget ?? adSet.lifetime_budget);
      if (currentBudget <= 0) continue;

      const perf = parseInsights(adSet.id, adSet.name, adSet.insights);
      if (perf.spend < minSpend) continue;

      const roasThreshold = minROAS * ROAS_BOOST_FACTOR;
      if (perf.roas < roasThreshold) continue;

      const newBudgetCents = Math.min(
        Math.round(currentBudget * (1 + BUDGET_INCREASE_PCT)),
        currentBudget * MAX_BUDGET_MULTIPLIER
      );
      if (newBudgetCents <= currentBudget) continue;

      try {
        await api.updateAdSetBudget(adSet.id, newBudgetCents);
        actions.push(
          options.reportAction({
            action: "Increased ad set budget",
            targetId: adSet.id,
            targetName: adSet.name,
            details: `daily_budget ${currentBudget} → ${newBudgetCents} (ROAS ${perf.roas.toFixed(2)})`,
          })
        );
      } catch {
        actions.push(
          options.reportAction({
            action: "Failed to update ad set budget",
            targetId: adSet.id,
            targetName: adSet.name,
            details: "API error",
          })
        );
      }
    }
  }

  return { actions };
}
