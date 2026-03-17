/**
 * TikTok agent runner: orchestrate auth, jobs, reporting for one or all clients.
 */

import type { ClientWithTikTok } from "core";
import {
  createReport,
  reportAction,
  createClaudeClient,
  type ReportAction as CoreReportAction,
  type PerformanceSnapshot,
  type RunReport,
} from "core";
import { createTikTokApiClient, getReportDateRange, parseReportRows } from "./api.js";
import { runPauseUnderperformers } from "./jobs/pause-underperformers.js";
import { runAdjustBudgets } from "./jobs/adjust-budgets.js";
import { runCopyCreatives } from "./jobs/copy-creatives.js";

export interface RunTikTokAgentOptions {
  client: ClientWithTikTok;
  accessToken: string;
  logger: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    action: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}

export interface RunTikTokAgentResult {
  report: RunReport;
  errors: string[];
}

const REPORT_DAYS = 7;

function toReportAction(p: {
  action: string;
  targetId?: string;
  targetName?: string;
  details?: string;
}): CoreReportAction {
  return reportAction(p);
}

export async function runTikTokAgent(options: RunTikTokAgentOptions): Promise<RunTikTokAgentResult> {
  const { client, accessToken, logger } = options;
  const errors: string[] = [];
  const allActions: CoreReportAction[] = [];
  let totalSpend = 0;
  const performanceSnapshots: PerformanceSnapshot[] = [];

  const api = createTikTokApiClient({ accessToken });
  const advertiserId = client.tiktokAdvertiserId;
  const thresholds = client.thresholds;
  const { startDate, endDate } = getReportDateRange(REPORT_DAYS);

  try {
    const reportRows = await api.getReport(advertiserId, {
      dataLevel: "AUCTION_ADGROUP",
      startDate,
      endDate,
    });
    const perfMap = parseReportRows(reportRows, "adgroup_id", "adgroup_name");
    for (const [, perf] of perfMap) {
      totalSpend += perf.spend;
      performanceSnapshots.push({
        id: perf.id,
        name: perf.name,
        spend: perf.spend,
        impressions: perf.impressions,
        conversions: perf.conversions,
        roas: perf.roas,
        cpa: perf.cpa,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to fetch performance: ${msg}`);
    logger.error(`Failed to fetch performance: ${msg}`, { clientName: client.clientName });
  }

  try {
    const pauseResult = await runPauseUnderperformers(api, advertiserId, thresholds, {
      reportAction: toReportAction,
    });
    allActions.push(...pauseResult.actions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Pause underperformers: ${msg}`);
    logger.error(`Pause underperformers failed: ${msg}`, { clientName: client.clientName });
  }

  try {
    const budgetResult = await runAdjustBudgets(api, advertiserId, thresholds, {
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
    const copyResult = await runCopyCreatives(api, advertiserId, claude, {
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
    agent: "tiktok",
    actions: allActions,
  };
  if (performanceSnapshots.length > 0) reportParams.performance = performanceSnapshots;
  if (totalSpend > 0) reportParams.totalSpend = totalSpend;
  if (errors.length > 0) reportParams.errors = errors;
  const report = createReport(reportParams);

  return { report, errors };
}
