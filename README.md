# Social Media Ad Management System

Two independent agents (Meta and TikTok) with a shared **core** library for config, logging, Claude, reporting, and notifications.

## Structure

- **core** – Shared library (config loader, logging, Claude client, reporting, notifications). Built first; agents depend on it.
- **agents/meta** – Meta Marketing API agent (auth, performance, pause underperformers, budgets, copy/creatives, cron).
- **agents/tiktok** – TikTok Marketing API agent (auth, performance, pause underperformers, budgets, copy updates, cron).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design, token handling, and APIs.  
**For step-by-step instructions on gathering and placing every credential (Meta and TikTok), see [CREDENTIALS.md](./CREDENTIALS.md).**

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `ANTHROPIC_API_KEY` – required for Claude (copy/decisions).
   - **Meta:** `META_APP_ID`, `META_APP_SECRET` (for token debug/refresh). Optional: `META_AGENT_CRON`.
   - **TikTok:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` (for token refresh). Optional: `TIKTOK_AGENT_CRON`.
   - Optional: `SMTP_*` for email alerts; `ADMIN_EMAIL` for token/error alerts when client has no `notificationEmail`; `REPORTS_DIR`.

3. **Client configs**

   Add one JSON file per client under `config/clients/`. See `config/clients/README.md` and `config/clients/example-client.json`.

## Build

```bash
npm run build
npm run build:core   # core only
```

## Scripts

- `npm run build` – build all workspaces
- `npm run build:core` – build core only
- `npm run meta` – run Meta agent (add `-- --once` for single run)
- `npm run tiktok` – run TikTok agent (add `-- --once` for single run)

## Token expiration

- **Meta:** Long-lived tokens can be refreshed via API before expiry; agents will alert when refresh fails or token is expired.
- **TikTok:** Access token is refreshed using the refresh token; agents will alert when refresh fails or refresh token is near expiry.

Details are in [ARCHITECTURE.md](./ARCHITECTURE.md#2-token-expiration-and-refresh).
