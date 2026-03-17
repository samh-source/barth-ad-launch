/**
 * Vercel serverless entry: run the Barth Express app.
 * All routes (static + /api/*) are handled by this handler.
 */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  const projectRoot = path.resolve(__dirname, "..");
  const { createServer } = await import("../barth/dist/server.js");
  const app = createServer(projectRoot);
  return app(req, res);
}
