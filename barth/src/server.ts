/**
 * Barth Express app: static UI and API routes.
 */

import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { clientsRoute } from "./routes/clients.js";
import { launchRoutes } from "./routes/launch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Barth Ad Launch</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.75rem; margin-bottom: 0.5rem; }
    p { margin: 0.5rem 0; }
    ul { margin: 0.5rem 0; padding-left: 1.5rem; }
    .updated { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated"><strong>Last updated:</strong> March 17, 2026</p>
  <h2>1. Who we are</h2>
  <p>Barth Ad Launch ("Barth") is an advertising management tool that uses the Meta Marketing API to create and manage ad campaigns on behalf of authorized business accounts. The operator of this application is the data controller for the data described below.</p>
  <h2>2. What data we collect and why</h2>
  <p>We collect and use only the data necessary to provide the service:</p>
  <ul>
    <li><strong>Account and API credentials:</strong> Meta ad account IDs and access tokens, stored in the business operator's own systems, to connect to the Meta Marketing API.</li>
    <li><strong>Campaign data:</strong> Ad campaign names, budgets, targeting settings, and creative content (e.g. video and image files) that you provide when creating or managing ads. This data is sent to Meta via the Marketing API to run your campaigns.</li>
    <li><strong>Optional brief text:</strong> Any campaign or creative brief you enter in the app, used only to generate ad copy and manage campaigns.</li>
  </ul>
  <p>We do not collect personal data from people who see your ads on Meta platforms (e.g. Facebook, Instagram). Meta's own policies apply to data collected on their platforms.</p>
  <h2>3. How we use your data</h2>
  <p>Your data is used solely to: connect to Meta's Marketing API and manage your ad accounts; create, edit, and run ad campaigns as you instruct; generate ad copy when you use that feature. We do not sell your data.</p>
  <h2>4. Data sharing and third parties</h2>
  <p>We share data only as needed: with Meta via the Marketing API (see Meta's Data Policy); with Anthropic's Claude when you use caption generation (see Anthropic's privacy policy). We do not share your data with other third parties for their marketing.</p>
  <h2>5. Data retention and storage</h2>
  <p>Configuration and credentials are stored in the business operator's environment for as long as the service is used. We do not retain a separate copy of your Meta account data beyond what is needed to fulfill API requests.</p>
  <h2>6. Your rights</h2>
  <p>Depending on where you live, you may have the right to access, correct, or delete your data. To exercise these rights, contact us using the details in Section 9.</p>
  <h2>7. Security</h2>
  <p>We take reasonable steps to protect your data (e.g. secure storage of credentials and HTTPS). No system is completely secure; you provide credentials and data at your own risk.</p>
  <h2>8. Changes to this policy</h2>
  <p>We may update this privacy policy from time to time. The "Last updated" date at the top will be revised when we do. Continued use of the service after changes means you accept the updated policy.</p>
  <h2>9. Contact</h2>
  <p>For privacy-related questions or requests, contact the business that operates this app at the email address listed in your Meta app settings, or via the contact method provided when you signed up for the service.</p>
</body>
</html>`;

export function createServer(projectRoot: string) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const publicDir = join(projectRoot, "barth", "public");
  const publicDirFromServer = join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  function sendPublicFile(res: express.Response, filename: string, contentType: string): boolean {
    for (const dir of [publicDir, publicDirFromServer]) {
      const p = join(dir, filename);
      try {
        if (existsSync(p)) {
          res.type(contentType).send(readFileSync(p, "utf-8"));
          return true;
        }
      } catch {
        /* skip */
      }
    }
    return false;
  }

  app.get(["/", "/index.html"], (_req, res) => {
    if (!sendPublicFile(res, "index.html", "html")) {
      res.type("html").send(
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Barth</title></head><body><h1>Barth</h1><p>Ad launch for Meta &amp; TikTok.</p><p><a href=\"/privacy.html\">Privacy policy</a></p><p>For the full UI, run <code>npm run barth</code> locally.</p></body></html>"
      );
    }
  });
  app.get("/styles.css", (_req, res) => {
    if (!sendPublicFile(res, "styles.css", "css")) res.status(404).end();
  });
  app.get("/app.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    if (!sendPublicFile(res, "app.js", "javascript")) res.status(404).end();
  });

  app.get("/privacy.html", (_req, res) => {
    try {
      const html = readFileSync(join(publicDir, "privacy.html"), "utf-8");
      res.type("html").send(html);
    } catch {
      res.type("html").send(PRIVACY_HTML);
    }
  });

  app.get("/api/clients", clientsRoute(projectRoot));

  const launch = launchRoutes(projectRoot);
  app.post("/api/launch", ...launch.postLaunch);
  app.get("/api/launch/stream", launch.getStream);

  // Ensure API errors (e.g. multer 413) always return JSON so the client never parses "Request Entity Too Large" as JSON
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Video too large for server (try a smaller file or run Barth locally)." });
      return;
    }
    res.status(500).json({ error: message || "Internal server error" });
  });

  return app;
}
