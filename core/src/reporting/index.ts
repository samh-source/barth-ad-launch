import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatReportAsCsv, formatReportAsHtml } from "./formatters.js";
import type { PerformanceSnapshot, ReportAction, RunReport } from "./types.js";

export type { PerformanceSnapshot, ReportAction, RunReport } from "./types.js";
export { formatReportAsCsv, formatReportAsHtml } from "./formatters.js";

/**
 * Build a report object. Agents pass platform-specific data; this only structures it.
 */
export function createReport(params: {
  clientName: string;
  agent: string;
  actions?: ReportAction[];
  performance?: PerformanceSnapshot[];
  totalSpend?: number;
  errors?: string[];
}): RunReport {
  const runAt = new Date().toISOString();
  const actions = params.actions ?? [];
  const summary: RunReport["summary"] = {
    actionsCount: actions.length,
  };
  if (params.totalSpend != null) summary.totalSpend = params.totalSpend;
  if (params.errors?.length) summary.errors = params.errors;
  const report: RunReport = {
    clientName: params.clientName,
    agent: params.agent,
    runAt,
    summary,
    actions,
  };
  if (params.performance != null) report.performance = params.performance;
  return report;
}

/**
 * Create a single action entry for the report.
 */
export function reportAction(params: {
  action: string;
  targetId?: string;
  targetName?: string;
  details?: string;
}): ReportAction {
  const entry: ReportAction = {
    timestamp: new Date().toISOString(),
    action: params.action,
  };
  if (params.targetId != null) entry.targetId = params.targetId;
  if (params.targetName != null) entry.targetName = params.targetName;
  if (params.details != null) entry.details = params.details;
  return entry;
}

export interface WriteReportOptions {
  /** Directory to write files into (default: reports under cwd) */
  reportsDir?: string;
  /** Optional filename prefix (default: client name + date) */
  filenamePrefix?: string;
}

const DEFAULT_REPORTS_DIR = "reports";

/**
 * Write report to CSV and HTML files. Filename format: {prefix}_{date}.{csv|html}.
 */
export async function writeReport(
  report: RunReport,
  options: WriteReportOptions = {}
): Promise<{ csvPath: string; htmlPath: string }> {
  const dir = options.reportsDir ?? join(process.cwd(), DEFAULT_REPORTS_DIR);
  const date = report.runAt.slice(0, 10);
  const prefix = options.filenamePrefix ?? `${report.clientName}_${report.agent}_${date}`.replace(/\s+/g, "-");
  const csvPath = join(dir, `${prefix}.csv`);
  const htmlPath = join(dir, `${prefix}.html`);

  const csv = formatReportAsCsv(report);
  const html = formatReportAsHtml(report);

  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(csvPath, csv, "utf-8"),
    writeFile(htmlPath, html, "utf-8"),
  ]);

  return { csvPath, htmlPath };
}
