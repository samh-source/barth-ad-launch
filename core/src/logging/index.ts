import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import type { LogContext, LogEntry, LogLevel } from "./types.js";

const LOG_LEVEL_ORDER: LogLevel[] = ["debug", "info", "warn", "error"];

function isEnabled(configured: LogLevel | undefined, level: LogLevel): boolean {
  if (!configured) return level !== "debug";
  return LOG_LEVEL_ORDER.indexOf(level) >= LOG_LEVEL_ORDER.indexOf(configured);
}

export interface LoggerOptions {
  /** Minimum level to output (default: info) */
  level?: LogLevel;
  /** Default context added to every log (e.g. agent name) */
  defaultContext?: LogContext;
  /** If set, also write JSON lines to this path (optional file logging) */
  filePath?: string;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLine(entry: LogEntry): string {
  const parts = [entry.timestamp, entry.level.toUpperCase(), entry.message];
  if (entry.clientName) parts.push(`[${entry.clientName}]`);
  if (entry.agent) parts.push(`(${entry.agent})`);
  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }
  return parts.join(" ");
}

export function createLogger(options: LoggerOptions = {}) {
  const { level: minLevel, defaultContext = {}, filePath } = options;
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

  async function ensureFile() {
    if (!filePath || fileHandle) return;
    try {
      await mkdir(dirname(filePath), { recursive: true });
    } catch {
      // ignore
    }
    fileHandle = await open(filePath, "a");
  }

  function buildEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const merged = { ...defaultContext, ...context };
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      message,
    };
    if (merged.clientName != null) entry.clientName = merged.clientName as string;
    if (merged.agent != null) entry.agent = merged.agent as string;
    const rest = Object.keys(merged).length > 0 ? (merged as Record<string, unknown>) : undefined;
    if (rest != null) entry.context = rest;
    return entry;
  }

  function write(entry: LogEntry) {
    const line = formatLine(entry);
    // eslint-disable-next-line no-console
    console.log(line);
    if (filePath) {
      ensureFile().then(() => {
        fileHandle?.write(`${JSON.stringify(entry)}\n`).catch(() => {});
      }).catch(() => {});
    }
  }

  function log(level: LogLevel, message: string, context?: LogContext) {
    if (!isEnabled(minLevel, level)) return;
    const entry = buildEntry(level, message, context);
    write(entry);
  }

  return {
    info(message: string, context?: LogContext) {
      log("info", message, context);
    },
    warn(message: string, context?: LogContext) {
      log("warn", message, context);
    },
    error(message: string, context?: LogContext) {
      log("error", message, context);
    },
    debug(message: string, context?: LogContext) {
      log("debug", message, context);
    },
    /** Log an action that should always be recorded (timestamp + client + agent) */
    action(message: string, context?: LogContext) {
      log("info", message, context);
    },
    async close() {
      if (fileHandle) {
        await fileHandle.close();
        fileHandle = undefined;
      }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
