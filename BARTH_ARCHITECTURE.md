# Barth — Web Interface & Launch Agent (Architecture)

Barth is an ad management agent with a **local web UI** that lets you upload a video, select client businesses, optionally add a brief, and **Launch** new Meta (and later TikTok) campaigns. Barth reuses the existing **core** library, **client configs**, and **Meta agent** for monitoring; the UI and “launch” flow are new.

---

## 1. What Barth Does

| Step | Behavior |
|------|----------|
| **User** | Opens UI at `localhost:3000`, drops a video, selects clients (from `config/clients/`), optionally enters a brief, clicks **Launch**. |
| **Barth (Meta)** | For each selected client: uploads the video to Meta as an ad creative, uses **Claude** to generate caption/copy from business name + brief, creates a **new campaign** (e.g. name includes “Barth”), creates an **ad set** with **$50/day** and **broad/auto** targeting, creates an **ad** with the video creative and generated copy, and **launches** it. |
| **Barth (TikTok)** | **Hooks only for now** — same conceptual flow (upload video, generate copy, create campaign, launch); implementation deferred until TikTok API credentials are approved. |
| **Monitoring** | Uses the **existing Meta agent** cron (every 6 hours): pauses underperformers, respects a **$50/day budget cap** — if the agent would increase budget above $50/day it **sends an approval alert** instead of auto-increasing. All errors and important events trigger alerts via the existing **core notifications** (and client `notificationEmail`). |

Barth is the **agent name** used in the UI, logs, and alerts (e.g. “Barth: launching for Sessco”, “Barth: campaign created”).

---

## 2. Where Barth Lives in the Repo

Barth is a **new workspace** at the same level as `core` and `agents/`, served by a small **Node server** that also serves the web UI and runs the launch logic.

```
c:\cursor meta and tik tok agents\
├── package.json                 # Add workspace "barth", script "barth": "npm run start -w barth"
├── core/
├── agents/
│   ├── meta/                    # Existing; monitoring + optional budget-cap behavior
│   └── tiktok/
├── config/
│   └── clients/                # Existing; Barth reads Meta clients from here
│
└── barth/                       # NEW — Barth app (server + UI)
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts             # Entry: load .env (project root), start Express on 3000
        ├── server.ts            # Express app: static, API routes, SSE for status
        ├── routes/
        │   ├── clients.ts       # GET /api/clients → Meta clients from core
        │   └── launch.ts        # POST /api/launch (multipart: video, clientIds[], brief)
        ├── barth/
        │   ├── meta.ts          # runBarthMetaLaunch(): upload video, Claude copy, create campaign/ad set/ad
        │   └── tiktok.ts        # Stub: runBarthTikTokLaunch() — no-op or “TikTok coming soon”
        └── middleware/
        │   └── env.ts           # Optional: ensure project-root .env loaded (like agents)
        └── (no public/ in src; see below)
    └── public/                  # Static assets (served by Express)
        ├── index.html           # Single page: drop zone, client checkboxes, brief, Launch, log
        └── app.js               # Fetch clients, handle drop, submit launch, consume SSE log
```

- **Root `package.json`**: add `"barth"` to `workspaces`, add script `"barth": "npm run start -w barth"`.
- **No changes** to `core/` or `config/` structure; Barth **depends on** `core` and reads the same `config/clients/` (path resolved from **project root**, same as Meta/TikTok agents).

---

## 3. Files Added (New)

| Path | Purpose |
|------|--------|
| **barth/package.json** | Workspace package: dependency on `core`, Express (and multer or similar for multipart), TypeScript. Scripts: `build`, `start` (node dist/index.js). |
| **barth/tsconfig.json** | Extends root `tsconfig.base.json`; `outDir: dist`, `rootDir: src`. |
| **barth/src/index.ts** | Load project-root `.env` (same pattern as agents), then start Express server (e.g. `server.listen(3000)`). Log: “Barth server at http://localhost:3000”. |
| **barth/src/server.ts** | Express app: `express.static('public')` (from barth’s package root), mount `/api/clients` and `/api/launch`, optionally `/api/launch/stream` or inline streaming for status. Use a single **in-memory status channel** per launch (e.g. EventEmitter or queue) that the launch handler pushes to and the status endpoint (SSE) consumes. |
| **barth/src/routes/clients.ts** | **GET /api/clients**: call core `loadClientsWithMeta({ clientsDir })` with **project-root** `config/clients` path; return `{ clients: [ { id, clientName } ] }` (id = `metaAccountId` or filename) for the UI checkboxes. Only Meta clients for now; structure allows adding TikTok clients later. |
| **barth/src/routes/launch.ts** | **POST /api/launch**: multipart body = `video` (file), `clientIds` (JSON array of client ids), `brief` (string, optional). Validate; then call `runBarthMetaLaunch(videoBuffer, clientIds, brief, statusCallback)`. Stream status back via **SSE** (e.g. `GET /api/launch/stream?runId=...`) or **polling** (e.g. `GET /api/launch/status?runId=...`). Return 200 with `{ runId }` so the client can open the stream or poll. |
| **barth/src/barth/meta.ts** | **runBarthMetaLaunch(video, clientIds, brief, onStatus)**. For each client: (1) Resolve client config (from core loader); (2) Ensure token valid (reuse or mirror Meta agent’s `ensureValidToken` if needed); (3) **Upload video** to Meta (Graph API: video upload to ad account, get `video_id`); (4) **Claude**: generate ad copy/caption from `clientName` + `brief` (core `createClaudeClient().generateCopy()`); (5) **Create campaign** (name e.g. “Barth – &lt;clientName&gt; – &lt;date&gt;”, objective e.g. OUTCOME_TRAFFIC or OUTCOME_ENGAGEMENT); (6) **Create ad set** (campaign_id, daily_budget = 5000 cents = $50, targeting = broad/auto); (7) **Create ad creative** (video_id + copy); (8) **Create ad** (ad set + creative); (9) Call `onStatus(message)` for each step so the UI can show a live log. Use core `createLogger` with `agent: "barth"` for server logs. |
| **barth/src/barth/tiktok.ts** | **runBarthTikTokLaunch(...)** — stub: `onStatus('TikTok launch not yet available.'); return;` or similar. Clear placeholder so TikTok can be wired in later (same signature as Meta where possible). |
| **barth/public/index.html** | Single page: title “Barth – Ad Launch”; **video drop zone** (file input or drag-and-drop); **checkbox list** “Select clients” (populated from GET /api/clients); **optional brief** textarea; **Launch** button; **status log** area (scrollable, append-only lines from SSE or polling). Minimal styling (clean, readable). |
| **barth/public/app.js** | On load: GET /api/clients, render checkboxes. On Launch: validate (video + at least one client); POST /api/launch (FormData: video, clientIds, brief); get `runId`; open EventSource to `/api/launch/stream?runId=...` (or poll) and append each message to the status log. Disable Launch while running; re-enable when stream ends or after a short delay. |

---

## 4. Files Modified (Existing)

| Path | Change |
|------|--------|
| **package.json** (root) | Add `"barth"` to `workspaces`. Add script `"barth": "npm run start -w barth"`. |
| **agents/meta/src/jobs/adjust-budgets.ts** (or runner) | Add **budget cap** behavior: if client has a “Barth” cap (e.g. `maxDailyBudget: 50` in thresholds or a new optional field), do **not** auto-increase budget above that; instead call core **sendAlert** with a message like “Barth: Approve budget increase for &lt;client&gt; / campaign &lt;id&gt;?” and skip the increase. Default for new Barth campaigns can be enforced by naming or a tag; for simplicity, a **global cap** (e.g. from thresholds or env) of $50/day “require approval above this” is enough so the existing Meta agent never auto-increases above $50 without an alert. (Exact field name can be `maxDailyBudgetAutoIncrease` or reuse `thresholds` with a new key.) |

No other existing files need to change for the **first version** of Barth; the Meta agent already runs every 6 hours and pauses underperformers. The only behavioral change is “don’t auto-increase above $50; send approval alert instead.”

---

## 5. Config and Environment

- **.env** (project root): Same as today. Barth uses `ANTHROPIC_API_KEY`, `META_APP_ID`, `META_APP_SECRET` (and later TikTok keys). Barth’s entrypoint loads `.env` from **project root** (same pattern as Meta/TikTok agents: resolve root from `import.meta.url` and `path.join(root, '.env')`).
- **config/clients/** (project root): Same JSON files. Barth loads **Meta clients** via core `loadClientsWithMeta({ clientsDir })` with `clientsDir` pointing at project root `config/clients`. Only clients with `metaAccountId` + `metaAccessToken` are offered in the UI for now.

---

## 6. API Surface (Barth Server)

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Serve `public/index.html`. |
| GET | /api/clients | Return `{ clients: [ { id, clientName } ] }` for Meta-only clients (id = e.g. `metaAccountId` or a stable id derived from config). |
| POST | /api/launch | Body: multipart — `video` (file), `clientIds` (JSON string array), `brief` (string). Starts Barth launch; returns `{ runId }`. Response can be 202 Accepted; client uses runId to stream status. |
| GET | /api/launch/stream?runId=... | SSE stream of status messages for that runId (e.g. “Barth: Starting launch for 2 clients”, “Barth: Uploading video for Sessco”, “Barth: Campaign created for Sessco”, …). |

Alternative to SSE: **polling** `GET /api/launch/status?runId=...` returning `{ status, messages[] }` until `status === 'done' | 'error'`. Either is fine; SSE is a bit simpler for a “live log” feel.

---

## 7. Meta Launch Flow (Detail)

Implement in **barth/src/barth/meta.ts**:

1. **Resolve clients** — From core loader, filter to those in `clientIds` (match by `metaAccountId` or by a client id you assign in GET /api/clients).
2. **Token** — Use the same token as the Meta agent (from client config). Optionally call Meta agent’s `ensureValidToken` (import from agents/meta) or duplicate minimal check; if invalid, `onStatus('Token invalid for &lt;client&gt;'); continue;` and optionally send alert.
3. **Video upload** — Meta Marketing API: create a **video** asset (e.g. POST to `act_{account_id}/advideos` with the file or a multipart upload as per Meta’s docs). Obtain `video_id`.
4. **Copy** — `createClaudeClient().generateCopy({ context: clientName + (brief ? ` Brief: ${brief}`) : '', tone: 'short, CTA-focused' })` → primary text and optionally headline.
5. **Campaign** — POST to Graph API `act_{account_id}/campaigns` with `name`, `objective` (e.g. OUTCOME_TRAFFIC), `status = ACTIVE`.
6. **Ad set** — POST to `{campaign_id}/adsets` with `daily_budget = 5000` (cents), `targeting = { "geo_locations": { "country_groups": ["worldwide"] } }` or equivalent “broad” preset, `status = ACTIVE`.
7. **Creative** — Create video ad creative with `video_id` and the generated copy (object_story_spec or equivalent for video).
8. **Ad** — POST to `{adset_id}/ads` with `creative = { creative_id }`, `name`, `status = ACTIVE`.
9. **Status** — After each step, call `onStatus('Barth: …')` and use core logger with `agent: 'barth'`.

If any step fails for a client, log and `onStatus('Barth: Error for &lt;client&gt;: …')`, send alert via core notifications, then continue with the next client or return.

---

## 8. TikTok Hooks (Later)

- **barth/src/barth/tiktok.ts** — Export `runBarthTikTokLaunch(video, clientIds, brief, onStatus)`. For now: push one message “TikTok launch not yet available” and return. Later: same flow as Meta (upload video, generate copy, create campaign/ad group/ad) using TikTok Marketing API and client `tiktokAdvertiserId` + token.
- **GET /api/clients** — Currently return only Meta clients. Later extend to include TikTok-only or dual clients and a `platform` or `meta`/`tiktok` flag so the UI can show “Meta” vs “TikTok” and call the right launch function.
- **POST /api/launch** — Request body can include `platforms: ['meta']` or `['meta','tiktok']`; server calls `runBarthMetaLaunch` and, if TikTok requested, `runBarthTikTokLaunch` (stub until credentials exist).

---

## 9. Monitoring and Alerts (Existing + Small Change)

- **Pause underperformers** — Already handled by the **Meta agent** cron (every 6 hours). No change.
- **Budget above $50/day** — In **agents/meta** (e.g. adjust-budgets job or runner): if the computed new budget would exceed **$50/day** (5000 cents), do **not** apply the increase; instead call core **sendAlert** with a message like “Barth: Approve budget increase for &lt;client&gt; / &lt;campaign/ad set&gt;?”. Optionally store “pending approval” state in memory or a small file so a future “approve” action can apply it. For v1, “alert only” is enough.
- **Errors** — Any Barth launch error or Meta agent error continues to use core notifications (and client `notificationEmail` / `ADMIN_EMAIL`).

---

## 10. Summary

| Item | Choice |
|------|--------|
| **New workspace** | `barth/` (server + static UI). |
| **Server** | Express on port 3000; project-root `.env` and project-root `config/clients`. |
| **UI** | Single page: video drop, client checkboxes (from API), optional brief, Launch, status log (SSE or poll). |
| **Launch (Meta)** | Upload video → Claude copy → create campaign ($50/day, broad) → create ad set → create creative → create ad → launch; status streamed to UI; all with “Barth” in logs/alerts. |
| **Launch (TikTok)** | Stub only; same API shape for later. |
| **Monitoring** | Existing Meta agent cron; add “no auto-increase above $50 without approval” + alert. |
| **Reuse** | core (config, Claude, logging, notifications), `config/clients/`, and Meta agent for monitoring. |

Once this architecture is approved, implementation can proceed: add `barth/` workspace, implement server + routes + `barth/meta.ts` (and stub `barth/tiktok.ts`), add the budget-cap behavior in the Meta agent, and build the static UI.
