/**
 * TikTok ad management agent — entrypoint.
 * Auth, performance pull, pause underperformers, adjust budgets, copy updates, reporting, cron.
 */

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
loadEnv({ path: join(PROJECT_ROOT, ".env") });

import cron from "node-cron";
import {
  loadClientsWithTikTok,
  createLogger,
  sendTokenAlert,
  writeReport,
  sendAlert,
} from "core";
import { ensureValidToken } from "./auth.js";
import { runTikTokAgent } from "./runner.js";

/** Project root config/clients (works when run from workspace via npm run tiktok) */
const CLIENTS_DIR = join(PROJECT_ROOT, "config", "clients");

const logger = createLogger({
  defaultContext: { agent: "tiktok" },
});

const CRON_SCHEDULE = process.env.TIKTOK_AGENT_CRON ?? "0 */6 * * *";

async function runOnce(): Promise<void> {
  const { clients, errors } = await loadClientsWithTikTok({ clientsDir: CLIENTS_DIR });
  if (errors.length > 0) {
    for (const e of errors) {
      logger.warn(`Config error: ${e.file}: ${e.error}`);
    }
  }
  if (clients.length === 0) {
    logger.info("No clients with TikTok credentials found.");
    return;
  }

  for (const client of clients) {
    const ctx = { clientName: client.clientName };

    const tokenResult = await ensureValidToken(client, {
      logger,
      sendTokenAlert: async (payload) => {
        const opts = client.notificationEmail ? { notificationEmail: client.notificationEmail } : {};
        return sendTokenAlert(payload, opts);
      },
    });

    const tokenToUse = tokenResult.token ?? client.tiktokAccessToken;
    if (!tokenResult.valid) {
      logger.warn(`Skipping ${client.clientName}: token invalid or refresh failed. Alert sent.`, ctx);
      continue;
    }

    try {
      const { report, errors: runErrors } = await runTikTokAgent({
        client,
        accessToken: tokenToUse,
        logger,
      });

      const { csvPath } = await writeReport(report, {
        reportsDir: process.env.REPORTS_DIR ?? "reports",
      });
      logger.info(`Report written: ${csvPath}`, ctx);

      if (runErrors.length > 0) {
        const opts = client.notificationEmail ? { notificationEmail: client.notificationEmail } : {};
        await sendAlert(
          {
            clientName: client.clientName,
            subject: "TikTok agent run had errors",
            body: runErrors.join("\n"),
            agent: "tiktok",
          },
          opts
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`TikTok agent run failed: ${message}`, ctx);
      const opts = client.notificationEmail ? { notificationEmail: client.notificationEmail } : {};
      await sendAlert(
        {
          clientName: client.clientName,
          subject: "TikTok agent run failed",
          body: message,
          agent: "tiktok",
        },
        opts
      );
    }
  }
}

async function main() {
  const runOnceFlag = process.argv.includes("--once");

  logger.info("TikTok agent starting");

  if (runOnceFlag) {
    await runOnce();
    logger.info("TikTok agent finished (--once)");
    process.exit(0);
  }

  await runOnce();

  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info("TikTok agent cron run");
    await runOnce();
  });

  logger.info(`TikTok agent scheduled (cron: ${CRON_SCHEDULE})`);
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
