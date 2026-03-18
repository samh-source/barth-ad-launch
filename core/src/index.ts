/**
 * Shared core library for Meta and TikTok ad management agents.
 * Load dotenv at app entry (e.g. agents): import "dotenv/config";
 */

// Config
export {
  loadAllClients,
  loadClientsWithMeta,
  loadClientsWithTikTok,
  parseClientConfig,
  isClientWithMeta,
  isClientWithTikTok,
  type LoaderOptions,
  type ClientConfig,
  type ClientWithMeta,
  type ClientWithTikTok,
  type ClientThresholds,
  type TikTokLaunchMode,
  clientConfigSchema,
} from "./config/index.js";

// Logging
export { createLogger, type Logger, type LoggerOptions } from "./logging/index.js";
export type { LogContext, LogEntry, LogLevel } from "./logging/types.js";

// Claude
export { createClaudeClient, type ClaudeClient, type ClaudeClientOptions } from "./claude/index.js";
export type {
  CopyGenerationInput,
  DecisionInput,
  ClaudeGenerateOptions,
  ClaudeMessage,
} from "./claude/types.js";

// Reporting
export {
  createReport,
  reportAction,
  writeReport,
  formatReportAsCsv,
  formatReportAsHtml,
  type WriteReportOptions,
} from "./reporting/index.js";
export type { RunReport, ReportAction, PerformanceSnapshot } from "./reporting/types.js";

// Notifications
export { sendEmail, sendTokenAlert, sendAlert, sendReportEmail } from "./notifications/index.js";
export type {
  TokenAlertPayload,
  AlertPayload,
  ReportEmailPayload,
} from "./notifications/types.js";
