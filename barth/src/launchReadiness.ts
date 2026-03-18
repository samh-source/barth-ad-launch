import type { ClientConfig } from "core";

export type LaunchPlatform = "meta" | "tiktok";

export interface ClientLaunchState {
  id: string;
  clientName: string;
  metaReady: boolean;
  metaIssue: string | null;
  tiktokReady: boolean;
  tiktokIssue: string | null;
  tiktokConfigured: boolean;
  tiktokLaunchMode: ClientConfig["tiktokLaunchMode"] | null;
}

export interface LaunchPreflightResult {
  selectedClients: ClientConfig[];
  errors: string[];
}

export function getMetaLaunchIssue(client: ClientConfig): string | null {
  if (!client.metaAccountId?.trim()) return "Meta ad account missing";
  if (!client.metaAccessToken?.trim()) return "Meta access token missing";
  if (!client.metaPageId?.trim()) return "Meta page ID missing";
  return null;
}

export function getTikTokLaunchIssue(client: ClientConfig): string | null {
  if (!client.tiktokAdvertiserId?.trim()) return "TikTok advertiser ID missing";
  if (!client.tiktokAccessToken?.trim()) return "TikTok access token missing";
  if (!client.tiktokLaunchMode) return "TikTok launch mode missing";
  if (!client.tiktokLocationIds?.length) return "TikTok location targeting missing";
  if (client.tiktokLaunchMode === "website_traffic" && !client.tiktokWebsiteUrl?.trim()) {
    return "TikTok website URL missing";
  }
  return null;
}

export function getClientLaunchState(client: ClientConfig): ClientLaunchState {
  const metaIssue = getMetaLaunchIssue(client);
  const tiktokIssue = getTikTokLaunchIssue(client);
  return {
    id: client.clientName,
    clientName: client.clientName,
    metaReady: metaIssue == null,
    metaIssue,
    tiktokReady: tiktokIssue == null,
    tiktokIssue,
    tiktokConfigured: Boolean(client.tiktokAdvertiserId && client.tiktokAccessToken),
    tiktokLaunchMode: client.tiktokLaunchMode ?? null,
  };
}

export function preflightSelectedClients(
  clients: ClientConfig[],
  clientIds: string[],
  platforms: LaunchPlatform[]
): LaunchPreflightResult {
  const selectedClients = clients.filter((client) => clientIds.includes(client.clientName));
  const errors: string[] = [];

  for (const clientId of clientIds) {
    if (!selectedClients.some((client) => client.clientName === clientId)) {
      errors.push(`${clientId}: client config not found`);
    }
  }

  for (const client of selectedClients) {
    for (const platform of platforms) {
      const issue = platform === "meta" ? getMetaLaunchIssue(client) : getTikTokLaunchIssue(client);
      if (issue) {
        errors.push(`${client.clientName}: ${issue}`);
      }
    }
  }

  return { selectedClients, errors };
}
