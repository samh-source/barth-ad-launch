/**
 * Barth Express app: static UI and API routes.
 */

import express from "express";
import { join } from "node:path";
import { clientsRoute } from "./routes/clients.js";
import { launchRoutes } from "./routes/launch.js";

export function createServer(projectRoot: string) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const publicDir = join(projectRoot, "barth", "public");
  app.use(express.static(publicDir));

  app.get("/api/clients", clientsRoute(projectRoot));

  const launch = launchRoutes(projectRoot);
  app.post("/api/launch", ...launch.postLaunch);
  app.get("/api/launch/stream", launch.getStream);

  return app;
}
