# Social Media Ad Management System — Architecture

This document describes the full project architecture for a two-agent system (Meta + TikTok) with a shared core library. No code is included; this is for review and approval before implementation.

---

## 1. Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | **Node.js** (LTS) | Single runtime for core + both agents; excellent async for many API calls; Meta’s official SDK is Node-first. |
| **Language** | **TypeScript** | Typed configs and API responses, safer refactors as you add clients and features. |
| **Package layout** | **Monorepo** (e.g. npm workspaces or pnpm workspaces) | One repo, shared `core` package, `meta-agent` and `tiktok-agent` depend on `core`; single `node_modules` at root. |
| **Scheduling** | **node-cron** (or **node-schedule**) | In-process cron per agent; simple and sufficient. For production at scale, you could later run the same entrypoints from external cron (e.g. systemd, GitHub Actions, or a job queue). |
| **Config format** | **JSON** (one file per client in `config/clients/`) | Easy to add clients by adding a file; no single huge file; can validate with a schema. |
| **Env/secrets** | **dotenv** + `.env` (never committed) | API keys for Claude, email, etc.; client tokens can live in config files with restricted permissions or in a secrets store later. |

**Alternative:** Python is also viable (e.g. `requests`, Anthropic SDK, `apscheduler`) if you prefer it; the same folder structure and module boundaries below would apply, with `core` and each agent as separate packages or modules.

---

## 2. Token Expiration and Refresh

### Meta (Facebook Marketing API)

- **Long-lived user tokens** expire in ~60 days. Meta provides a **refresh endpoint** (`/refresh_access_token`) that can extend a valid long-lived token by another 60 days **without user re-login**. Refresh must be done server-side (app secret required).
- **System User** access tokens (from Meta Business Manager) do not expire and are ideal for production; no refresh or expiry alerts needed.

**Handling in the Meta agent:**

1. **Auto-refresh:** Before each run (or on a schedule), call the [Token Debug](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/debugging/) endpoint to get `expires_at`. If the token expires in less than a configured window (e.g. 7 days), call the refresh endpoint to obtain a new long-lived token. The agent (or a small config-writer helper) can then update the client config with the new token and new expiry so the next run uses it.
2. **Alert when refresh fails or token expired:** If refresh fails (e.g. token already expired, or API error), use the core notifications module to send an alert (e.g. email) to the client’s `notificationEmail` and optionally a global admin: “Meta token for client X expired or refresh failed; please re-authorize in Meta Business Manager.”
3. **Optional “expiring soon” alert:** If you prefer to be warned before relying on auto-refresh, the Meta agent can also send a “token expires in N days” warning when expiry is within the threshold and (optionally) when a refresh attempt has not yet been made.

So: **auto-refresh when possible** (long-lived token, before expiry), **alert when close to expiring** (optional) and **alert when refresh fails or token is already expired** (required).

### TikTok Marketing API

- **Access tokens** expire in **24 hours**. **Refresh tokens** are valid for **365 days**. You obtain a new access token by calling the OAuth token endpoint with `grant_type=refresh_token` and the client’s `refresh_token` (no user re-auth during that year).

**Handling in the TikTok agent:**

1. **Auto-refresh:** Before each run (or when the current access token is expired or about to expire), call the TikTok token endpoint with the client’s `refresh_token` to get a new access token. Store the new access token (and new refresh token if returned) in the client config or in memory for the run. Client config must include `tiktokRefreshToken` (and optionally `tiktokRefreshTokenExpiresAt` for 365-day visibility).
2. **Alert when refresh fails:** If the refresh call fails (e.g. refresh token revoked or expired), use the core notifications module to alert the client and/or admin: “TikTok token for client X could not be refreshed; please re-authorize.”
3. **Optional “refresh token expiring soon” alert:** If you store `tiktokRefreshTokenExpiresAt`, the TikTok agent can send a warning when the refresh token is within e.g. 30 days of expiring so you can re-authorize in time.

So: **auto-refresh the access token** before or during each run; **alert when refresh fails**; optionally **alert when the refresh token is close to expiring**.

### Role of the core library

- **Notifications:** The core notifications module will support a generic “token expiring / refresh failed” alert type (e.g. `sendTokenAlert({ clientName, platform: 'meta' | 'tiktok', message })`) so both agents can use the same email (or other) channel without duplicating logic.
- **Config:** Client config will support optional fields for expiry and refresh: e.g. `metaTokenExpiresAt` (ISO date), `tiktokRefreshToken`, `tiktokRefreshTokenExpiresAt`. Agents are responsible for refreshing and, if desired, writing updated tokens/expiry back to config or a secure store; core only loads and validates config.

---

## 3. Folder Structure

```
c:\cursor meta and tik tok agents\
├── package.json                 # Workspace root; scripts to run each agent
├── pnpm-workspace.yaml          # Or npm workspaces in package.json
├── tsconfig.base.json           # Shared TS options
├── .env.example                 # Template for required env vars
├── .gitignore
├── ARCHITECTURE.md              # This file
├── README.md
│
├── core/                        # Shared library (used by both agents)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Re-exports all public modules
│       ├── claude/              # Claude API for copy and decisions
│       │   ├── index.ts
│       │   └── types.ts
│       ├── config/              # Client config loading and validation
│       │   ├── index.ts
│       │   ├── loader.ts
│       │   ├── schema.ts        # Optional: JSON schema for client config
│       │   └── types.ts
│       ├── logging/             # Timestamped logging with client name
│       │   ├── index.ts
│       │   └── types.ts
│       ├── reporting/           # Report generation and formatting
│       │   ├── index.ts
│       │   ├── formatters.ts    # CSV, HTML, etc.
│       │   └── types.ts
│       └── notifications/       # Alerting (email, etc.)
│           ├── index.ts
│           └── types.ts
│
├── agents/
│   ├── meta/
│   │   ├── package.json         # Depends on core
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # Entrypoint: start cron / run once
│   │       ├── auth.ts          # Meta Marketing API authentication
│   │       ├── api.ts           # Campaigns, ad sets, ads; pause; budgets; creatives
│   │       ├── runner.ts        # Orchestration: load clients → fetch → decide → act → report
│   │       ├── jobs/            # Optional: one file per job type (pause, budget, copy)
│   │       │   ├── pause-underperformers.ts
│   │       │   ├── adjust-budgets.ts
│   │       │   └── copy-creatives.ts
│   │       └── types.ts
│   │
│   └── tiktok/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── auth.ts
│           ├── api.ts
│           ├── runner.ts
│           ├── jobs/
│           │   ├── pause-underperformers.ts
│           │   ├── adjust-budgets.ts
│           │   └── copy-creatives.ts
│           └── types.ts
│
├── config/
│   ├── clients/                 # One JSON file per client
│   │   ├── acme-corp.json
│   │   ├── brand-two.json
│   │   └── ...
│   └── README.md                # How to add a client; field descriptions
│
├── logs/                        # Runtime logs (gitignored or rotated)
│   └── .gitkeep
│
└── reports/                     # Generated reports (gitignored or archived)
    └── .gitkeep
```

You open this one folder in Cursor; `core`, `agents/meta`, and `agents/tiktok` are all in the same repo. Changes to `core` (e.g. logging or Claude) automatically apply to both agents.

---

## 4. What Each Module Does

### 3.1 Core library

- **`core/src/claude`**
  - Wrapper around the Claude API (Anthropic SDK or `fetch`).
  - Responsibilities: generate or refine ad copy, and optionally suggest decisions (e.g. “pause this ad set?”, “suggest budget change”) from performance summary.
  - Inputs: prompt template, performance summary, client/account context. Output: text (copy or structured decision). No platform-specific logic.

- **`core/src/config`**
  - Load all client configs from `config/clients/*.json`.
  - Validate required fields and types (and optional JSON schema).
  - Expose: “get all clients”, “get clients that have Meta”, “get clients that have TikTok”. Handles missing Meta or TikTok credentials gracefully (client present but no `metaAccountId` / `tiktokAdvertiserId`).

- **`core/src/logging`**
  - Every log line includes timestamp (ISO) and client name (and optionally agent name).
  - Log to stdout and optionally to a file in `logs/` (e.g. one file per day or per agent). No business logic; only formatting and I/O.

- **`core/src/reporting`**
  - Build in-memory report structure (e.g. summary + list of actions taken, performance snapshot).
  - Format as CSV and/or HTML (and optionally PDF later). Save to `reports/` with filename including client name and date. Used by both agents with the same interface; platform-specific data is passed in as a common shape.

- **`core/src/notifications`**
  - Send alerts (e.g. email via SendGrid, Resend, or SMTP): threshold breaches, errors, or daily summary.
  - Uses config: notification email per client (and optional global admin email from env). Core only sends; it does not decide when to send (that’s the agent’s job).

### 3.2 Meta agent

- **`agents/meta/src/auth.ts`**
  - Meta Marketing API authentication: ensure a valid access token (and optional refresh if using long-lived tokens). No TikTok logic.

- **`agents/meta/src/api.ts`**
  - All Meta Marketing API calls: fetch campaigns, ad sets, ads and their performance (e.g. spend, impressions, conversions); pause/resume underperformers; update budgets; create/update ad copy and creatives. Uses Meta’s official SDK or direct REST; no TikTok.

- **`agents/meta/src/runner.ts`**
  - Orchestration: load clients with Meta config (via core config), for each client call `api` to pull data, compare to thresholds (from config), call core Claude for copy/decisions if needed, call `api` to apply actions, use core logging/reporting/notifications. Schedules the “run” on a cron (e.g. every N hours).

- **`agents/meta/src/jobs/`** (optional)
  - Split runner logic into small jobs: pause underperformers, adjust budgets, refresh copy/creatives. Runner runs these in sequence or on different schedules.

- **`agents/meta/src/index.ts`**
  - Entrypoint: start the cron (or run once if `--once`). No TikTok imports.

### 3.3 TikTok agent

- **`agents/tiktok/src/auth.ts`**
  - TikTok Marketing API authentication (token validation / refresh if applicable). No Meta logic.

- **`agents/tiktok/src/api.ts`**
  - All TikTok Marketing API calls: campaigns, ad groups, ads, performance; pause underperformers; adjust budgets; create/update ad copy and creatives. No Meta.

- **`agents/tiktok/src/runner.ts`**
  - Same role as Meta runner but for TikTok: load TikTok clients, fetch data, thresholds, Claude, apply actions, log, report, notify. Own cron schedule.

- **`agents/tiktok/src/jobs/`** (optional)
  - Same idea as Meta jobs: pause, budget, copy/creatives.

- **`agents/tiktok/src/index.ts`**
  - Entrypoint: start TikTok cron or run once. No Meta imports.

Agents are independent: you can run only Meta, only TikTok, or both; each uses only its own config fields and the shared core.

---

## 5. Client Config Shape

Each file under `config/clients/` (e.g. `acme-corp.json`) should support at least:

| Field | Required | Description |
|-------|----------|-------------|
| `clientName` | Yes | Display name for logs and reports. |
| `metaAccountId` | No | Meta ad account ID (e.g. `act_123`). If absent, Meta agent skips this client. |
| `metaAccessToken` | No | Meta long-lived access token. Required if `metaAccountId` is set. |
| `metaTokenExpiresAt` | No | ISO date string when the Meta token expires; used for refresh and expiry alerts. |
| `tiktokAdvertiserId` | No | TikTok advertiser ID. If absent, TikTok agent skips this client. |
| `tiktokAccessToken` | No | TikTok access token. Required if `tiktokAdvertiserId` is set. |
| `tiktokRefreshToken` | No | TikTok refresh token; required for auto-refreshing the access token. |
| `tiktokRefreshTokenExpiresAt` | No | ISO date when the TikTok refresh token expires (e.g. 365 days); used for expiry alerts. |
| `thresholds` | No | Object: e.g. `minROAS`, `maxCPA`, `minSpendToEvaluate`; used to decide underperformers and budget changes. |
| `notificationEmail` | No | Email for alerts and reports. |

Validation in `core/config`: if `metaAccountId` is present then `metaAccessToken` must be present (and vice versa); same for TikTok. Clients with only Meta or only TikTok are valid.

---

## 6. APIs to Set Up

| API | Purpose | Where to get credentials / docs |
|-----|---------|---------------------------------|
| **Meta Marketing API** | Campaigns, ad sets, ads, insights, pause, budget, creatives. | Meta for Developers → App → Marketing API; generate long-lived User Access Token with `ads_management`, `ads_read`, etc. |
| **TikTok Marketing API** | Campaigns, ad groups, ads, reports, pause, budget, creatives. | TikTok for Business → Assets → TikTok Marketing API; create an app and get access token for the advertiser. |
| **Claude (Anthropic)** | Copy generation and optimization decisions. | Anthropic console → API keys. |
| **Email (optional)** | Notifications and report delivery. | SendGrid, Resend, or SMTP; key or credentials in `.env`. |

No code is written yet; this list is for you to create apps and keys before or during implementation.

---

## 7. Data Flow (Conceptual)

1. **Config**  
   Core loads `config/clients/*.json` and exposes “clients with Meta” / “clients with TikTok”.

2. **Meta agent (per run)**  
   For each client with Meta: auth → pull campaigns/ad sets/ads and performance → compare to thresholds → optionally ask Claude for copy or decisions → pause underperformers, adjust budgets, update copy/creatives → log every action with timestamp and client name → generate report → send notification if configured.

3. **TikTok agent (per run)**  
   Same flow using TikTok auth and TikTok API; same use of core for config, Claude, logging, reporting, notifications.

4. **Scaling**  
   Adding a client = adding one JSON file under `config/clients/`. No code change. If you later need per-client schedules or feature flags, extend the client config and have the runner read them.

---

## 8. Logging and Reports

- **Logging:** Every action (e.g. “Paused ad set X”, “Updated budget for Y”, “Generated copy for Z”) is logged with:
  - Timestamp (ISO)
  - Client name
  - Agent (Meta / TikTok)
  - Action and relevant IDs/details  
  Core logging module is the single place that defines this format so both agents stay consistent.

- **Reports:** Core reporting module produces files (and optionally in-memory payload for email) with:
  - Client name, date, agent
  - Performance snapshot (e.g. spend, ROAS, CPA)
  - List of actions taken  
  Format (CSV/HTML) is shared; agents pass platform-specific data into a common report structure.

---

## 9. Summary

- **One repo**, one folder in Cursor: `core` + `agents/meta` + `agents/tiktok`.
- **Shared core:** Claude, config, logging, reporting, notifications. Improve once, both agents benefit.
- **Independent agents:** Meta-only and TikTok-only code; each has its own auth, API, runner, and cron.
- **Multi-client:** One config file per client; optional Meta and/or TikTok; thresholds and notification email per client.
- **Tech stack:** Node.js + TypeScript, monorepo, node-cron, JSON config, dotenv.
- **APIs:** Meta Marketing API, TikTok Marketing API, Claude, optional email provider.

If you approve this architecture, the next step is to implement it (e.g. scaffold monorepo → core → Meta agent → TikTok agent) without changing the structure above unless you request edits.
