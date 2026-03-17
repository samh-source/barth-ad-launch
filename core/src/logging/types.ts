export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  /** Client name for multi-tenant logging */
  clientName?: string;
  /** Agent or service name (e.g. "meta", "tiktok") */
  agent?: string;
  /** Optional structured data to include in the log line or JSON output */
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  clientName?: string;
  agent?: string;
  context?: Record<string, unknown>;
}
