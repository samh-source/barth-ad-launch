/**
 * Meta agent runner: orchestrate auth, jobs, reporting for one or all clients.
 */

import type { ClientWithMeta } from "core";
import {
  createReport,
  reportAction,
  createClaudeClient,
  type ReportAction as CoreReportAction,
  type PerformanceSnapshot,
  type RunReport,
} from "core";
import { createMetaApiClient, parseInsights } from "./api.js";
import { runPauseUnderperformers } from "./jobs/pause-underperformers.js";
import { runAdjustBudgets } from "./jobs/adjust-budgets.js";
import { runCopyCreatives } from "./jobs/copy-creatives.js";
import type { MetaAdSet } from "./types.js";

export interface RunMetaAgentOptions {
  client: ClientWithMeta;
  /** Token to use (current or refreshed) */
  accessToken: string;
  logger: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    action: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}

export interface RunMetaAgentResult {
  report: RunReport;
  errors: string[];
}

function toReportAction(p: {
  action: string;
  targetId?: string;
  targetName?: string;
  details?: string;
}): CoreReportAction {
  return reportAction(p);
}

export async function runMetaAgent(options: RunMetaAgentOptions): Promise<RunMetaAgentResult> {
  const { client, accessToken, logger } = options;
  const errors: string[] = [];
  const allActions: CoreReportAction[] = [];
  let totalSpend = 0;
  const performanceSnapshots: PerformanceSnapshot[] = [];

  const api = createMetaApiClient({ accessToken });
  const accountId = client.metaAccountId;
  const thresholds = client.thresholds;

  try {
    const campaigns = await api.getCampaigns(accountId, { withInsights: true });
    for (const campaign of campaigns) {
      const perf = parseInsights(campaign.id, campaign.name, campaign.insights);
      totalSpend += perf.spend;
      performanceSnapshots.push({
        id: campaign.id,
        name: campaign.name,
        spend: perf.spend,
        impressions: perf.impressions,
        conversions: perf.conversions,
        roas: perf.roas,
        cpa: perf.cpa,
      });
      const adSets = await api.getAdSets(campaign.id, { withInsights: true });
      for (const adSet of adSets as MetaAdSet[]) {
        const adSetPerf = parseInsights(adSet.id, adSet.name, adSet.insights);
        performanceSnapshots.push({
          id: adSet.id,
          name: adSet.name,
          spend: adSetPerf.spend,
          impressions: adSetPerf.impressions,
          conversions: adSetPerf.conversions,
          roas: adSetPerf.roas,
          cpa: adSetPerf.cpa,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to fetch performance: ${msg}`);
    logger.error(`Failed to fetch performance: ${msg}`, { clientName: client.clientName });
  }

  try {
    const pauseResult = await runPauseUnderperformers(api, accountId, thresholds, {
      reportAction: toReportAction,
    });
    allActions.push(...pauseResult.actions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Pause underperformers: ${msg}`);
    logger.error(`Pause underperformers failed: ${msg}`, { clientName: client.clientName });
  }

  try {
    const budgetResult = await runAdjustBudgets(api, accountId, thresholds, {
      reportAction: toReportAction,
    });
    allActions.push(...budgetResult.actions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Adjust budgets: ${msg}`);
    logger.error(`Adjust budgets failed: ${msg}`, { clientName: client.clientName });
  }

  try {
    const claude = createClaudeClient();
    const copyResult = await runCopyCreatives(api, accountId, claude, {
      reportAction: toReportAction,
      logger,
    });
    allActions.push(...copyResult.actions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Copy/creatives: ${msg}`);
    logger.error(`Copy creatives failed: ${msg}`, { clientName: client.clientName });
  }

  for (const a of allActions) {
    logger.action(a.action, {
      clientName: client.clientName,
      targetId: a.targetId,
      targetName: a.targetName,
      details: a.details,
    });
  }

  const reportParams: Parameters<typeof createReport>[0] = {
    clientName: client.clientName,
    agent: "meta",
    actions: allActions,
  };
  if (performanceSnapshots.length > 0) reportParams.performance = performanceSnapshots;
  if (totalSpend > 0) reportParams.totalSpend = totalSpend;
  if (errors.length > 0) reportParams.errors = errors;
  const report = createReport(reportParams);

  return { report, errors };
}
