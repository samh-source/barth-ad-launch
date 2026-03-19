#!/usr/bin/env node
/**
 * Attempt to refresh Meta access tokens for all clients with metaAccessToken.
 * Writes updated tokens back to config/clients/*.json.
 * Only works if the current token is still valid (or within refresh window).
 * Revoked tokens cannot be refreshed; regenerate manually via Graph API Explorer.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

const ROOT = process.cwd();
config({ path: join(ROOT, ".env") });

const GRAPH = "https://graph.facebook.com/v21.0";
const CLIENTS_DIR = join(ROOT, "config", "clients");

function getAppCredentials() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

async function refreshToken(currentToken) {
  const creds = getAppCredentials();
  if (!creds) {
    console.error("META_APP_ID and META_APP_SECRET required in .env");
    process.exit(1);
  }
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", creds.appId);
  url.searchParams.set("client_secret", creds.appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error || !data.access_token) {
    return null;
  }
  return data.access_token;
}

async function main() {
  const files = readdirSync(CLIENTS_DIR).filter((f) => f.endsWith(".json"));
  let updated = 0;

  for (const file of files) {
    const path = join(CLIENTS_DIR, file);
    const raw = readFileSync(path, "utf-8");
    let config;
    try {
      config = JSON.parse(raw);
    } catch {
      continue;
    }
    const token = config.metaAccessToken?.trim();
    if (!token) continue;

    console.log(`Trying ${config.clientName}...`);
    const newToken = await refreshToken(token);
    if (newToken) {
      config.metaAccessToken = newToken;
      writeFileSync(path, JSON.stringify(config, null, 2));
      console.log(`  ✓ Refreshed and saved`);
      updated++;
    } else {
      console.log(`  ✗ Refresh failed (token may be revoked — regenerate manually)`);
    }
  }

  console.log(`\nDone. Updated ${updated} client(s).`);
  if (updated === 0) {
    console.log("If all failed: tokens are revoked. Regenerate at developers.facebook.com/tools/explorer");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
