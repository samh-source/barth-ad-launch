/**
 * Barth — entrypoint. Load project-root .env and start the Express server.
 */

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
loadEnv({ path: join(PROJECT_ROOT, ".env") });

import { createServer } from "./server.js";

const PORT = Number(process.env.BARTH_PORT) || 3000;
const app = createServer(PROJECT_ROOT);

app.listen(PORT, () => {
  console.log(`Barth: server at http://localhost:${PORT}`);
});
