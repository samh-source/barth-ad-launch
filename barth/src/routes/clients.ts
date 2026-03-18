/**
 * GET /api/clients — return launchable clients and platform readiness for Barth UI.
 */

import { loadAllClients } from "core";
import { join } from "node:path";
import type { Request, Response } from "express";
import { getClientLaunchState } from "../launchReadiness.js";

const CLIENTS_DIR_NAME = "config";
const CLIENTS_SUBDIR = "clients";

export function clientsRoute(projectRoot: string) {
  const clientsDir = join(projectRoot, CLIENTS_DIR_NAME, CLIENTS_SUBDIR);

  return async (_req: Request, res: Response) => {
    try {
      const { clients, errors } = await loadAllClients({ clientsDir });
      if (errors.length > 0) {
        console.warn("Barth: config errors loading clients:", errors);
      }
      const list = clients
        .filter((c) => c.metaAccountId || c.tiktokAdvertiserId || c.tiktokLaunchMode)
        .map((c) => getClientLaunchState(c));
      res.json({ clients: list });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Barth: GET /api/clients failed:", message);
      res.status(500).json({ error: message });
    }
  };
}
