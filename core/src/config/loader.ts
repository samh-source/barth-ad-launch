import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientConfig, ClientWithMeta, ClientWithTikTok } from "./types.js";
import { isClientWithMeta, isClientWithTikTok } from "./types.js";

export interface LoaderOptions {
  /** Directory containing client JSON files (default: config/clients relative to cwd) */
  clientsDir?: string;
}

const DEFAULT_CLIENTS_DIR = "config/clients";

/**
 * Load and parse a single client config file. Throws on invalid JSON or validation failure.
 */
export function parseClientConfig(raw: string): ClientConfig {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object") {
    throw new Error("Client config must be a JSON object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.clientName !== "string" || !obj.clientName.trim()) {
    throw new Error("clientName is required and must be a non-empty string");
  }
  const clientName = String(obj.clientName).trim();

  // Meta: if either is set, both must be set
  const metaAccountId = obj.metaAccountId == null ? undefined : String(obj.metaAccountId).trim();
  const metaAccessToken = obj.metaAccessToken == null ? undefined : String(obj.metaAccessToken);
  if (metaAccountId && !metaAccessToken) {
    throw new Error("metaAccessToken is required when metaAccountId is set");
  }
  if (metaAccessToken && !metaAccountId) {
    throw new Error("metaAccountId is required when metaAccessToken is set");
  }

  // TikTok: if either advertiser id or access token is set, both must be set
  const tiktokAdvertiserId =
    obj.tiktokAdvertiserId == null ? undefined : String(obj.tiktokAdvertiserId).trim();
  const tiktokAccessToken =
    obj.tiktokAccessToken == null ? undefined : String(obj.tiktokAccessToken);
  if (tiktokAdvertiserId && !tiktokAccessToken) {
    throw new Error("tiktokAccessToken is required when tiktokAdvertiserId is set");
  }
  if (tiktokAccessToken && !tiktokAdvertiserId) {
    throw new Error("tiktokAdvertiserId is required when tiktokAccessToken is set");
  }

  const notificationEmail =
    obj.notificationEmail == null ? undefined : String(obj.notificationEmail).trim();
  const metaTokenExpiresAt =
    obj.metaTokenExpiresAt == null ? undefined : String(obj.metaTokenExpiresAt);
  const metaPageId = obj.metaPageId == null ? undefined : String(obj.metaPageId).trim();
  const tiktokRefreshToken =
    obj.tiktokRefreshToken == null ? undefined : String(obj.tiktokRefreshToken);
  const tiktokRefreshTokenExpiresAt =
    obj.tiktokRefreshTokenExpiresAt == null
      ? undefined
      : String(obj.tiktokRefreshTokenExpiresAt);

  let thresholds: ClientConfig["thresholds"];
  if (obj.thresholds != null && typeof obj.thresholds === "object") {
    const t = obj.thresholds as Record<string, unknown>;
    thresholds = {};
    if (typeof t.minROAS === "number") thresholds.minROAS = t.minROAS;
    if (typeof t.maxCPA === "number") thresholds.maxCPA = t.maxCPA;
    if (typeof t.minSpendToEvaluate === "number")
      thresholds.minSpendToEvaluate = t.minSpendToEvaluate;
    if (typeof t.minConversionsToEvaluate === "number")
      thresholds.minConversionsToEvaluate = t.minConversionsToEvaluate;
  }

  const config: ClientConfig = { clientName };
  if (notificationEmail) config.notificationEmail = notificationEmail;
  if (thresholds) config.thresholds = thresholds;
  if (metaAccountId) config.metaAccountId = metaAccountId;
  if (metaAccessToken) config.metaAccessToken = metaAccessToken;
  if (metaPageId) config.metaPageId = metaPageId;
  if (metaTokenExpiresAt) config.metaTokenExpiresAt = metaTokenExpiresAt;
  if (tiktokAdvertiserId) config.tiktokAdvertiserId = tiktokAdvertiserId;
  if (tiktokAccessToken) config.tiktokAccessToken = tiktokAccessToken;
  if (tiktokRefreshToken) config.tiktokRefreshToken = tiktokRefreshToken;
  if (tiktokRefreshTokenExpiresAt) config.tiktokRefreshTokenExpiresAt = tiktokRefreshTokenExpiresAt;
  return config;
}

/**
 * Load all client configs from the clients directory.
 * Only .json files are read. Invalid files are skipped and reported in the errors array.
 */
export async function loadAllClients(
  options: LoaderOptions = {}
): Promise<{ clients: ClientConfig[]; errors: { file: string; error: string }[] }> {
  const dir = options.clientsDir ?? join(process.cwd(), DEFAULT_CLIENTS_DIR);
  const errors: { file: string; error: string }[] = [];
  const clients: ClientConfig[] = [];

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { clients: [], errors: [{ file: dir, error: `Failed to read directory: ${message}` }] };
  }

  const jsonFiles = entries.filter((e) => e.endsWith(".json"));

  for (const file of jsonFiles) {
    const path = join(dir, file);
    try {
      const raw = await readFile(path, "utf-8");
      const config = parseClientConfig(raw);
      clients.push(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ file: path, error: message });
    }
  }

  return { clients, errors };
}

/**
 * Load all clients that have Meta credentials. Skips clients without Meta.
 */
export async function loadClientsWithMeta(
  options?: LoaderOptions
): Promise<{ clients: ClientWithMeta[]; errors: { file: string; error: string }[] }> {
  const { clients, errors } = await loadAllClients(options);
  return {
    clients: clients.filter(isClientWithMeta),
    errors,
  };
}

/**
 * Load all clients that have TikTok credentials. Skips clients without TikTok.
 */
export async function loadClientsWithTikTok(
  options?: LoaderOptions
): Promise<{ clients: ClientWithTikTok[]; errors: { file: string; error: string }[] }> {
  const { clients, errors } = await loadAllClients(options);
  return {
    clients: clients.filter(isClientWithTikTok),
    errors,
  };
}
