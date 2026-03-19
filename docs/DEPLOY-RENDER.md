# Host Barth on Render (large video uploads)

Vercel caps request bodies at ~**4.5 MB**. Barth on **Render** runs as a full **Node web service**, so uploads can use the app limit (**500 MB** in code)—suitable for high-res ~15s videos.

Barth's launch flow is built around:

- a normal long-lived Node server
- background launch work after the upload request returns
- in-memory run logs for SSE streaming

That makes **Render supported** and **Vercel unsupported** for production launches.

## 1. Push this repo to GitHub (if needed)

Render deploys from Git.

## 2. Create the service

1. Open [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the repo and select the branch.
3. Render reads **`render.yaml`** at the repo root.
4. When prompted, set these environment variables:
   - **`ANTHROPIC_API_KEY`** — required for caption generation.
   - **`META_ACCESS_TOKEN`** — **required for Meta launches.** Use your long-lived Meta token here. This overrides config; update here instead of pushing config changes.
   - **`META_APP_ID`** — for token validation (optional; if unset, validation is skipped).
   - **`META_APP_SECRET`** — for token validation (optional).
   - **`TIKTOK_CLIENT_KEY`** — for TikTok token refresh.
   - **`TIKTOK_CLIENT_SECRET`** — for TikTok token refresh.

## 3. After deploy

- Open the URL Render gives you (e.g. `https://barth-ad-launch.onrender.com`).
- **Free tier:** the service **sleeps** after ~15 minutes idle. The first request after sleep can take **30–60 seconds** (cold start).
- Client Meta configs live in **`config/clients/*.json`** in the repo—what you push is what production uses.
- Client TikTok configs also live in **`config/clients/*.json`** in the repo—production launch readiness comes from those checked-in files.

## 4. Production checklist

- `ANTHROPIC_API_KEY` is set in Render.
- `META_ACCESS_TOKEN` is set in Render (your Meta long-lived token — this overrides config and avoids deploy for token updates).
- `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` are set in Render.
- `META_APP_ID` and `META_APP_SECRET` are set in Render.
- `config/clients/*.json` in the deployed branch contains the real per-client Meta/TikTok credentials.
- TikTok-ready clients have:
  - `tiktokAdvertiserId`
  - `tiktokAccessToken`
  - `tiktokLaunchMode`
  - `tiktokLocationIds`
  - `tiktokWebsiteUrl` for `website_traffic`
- Meta-ready clients have:
  - `metaAccountId`
  - `metaAccessToken`
  - `metaPageId`

## 5. Optional

- **Custom domain:** Render dashboard → your service → **Settings** → **Custom Domain**.
- **Stop using Vercel** for Barth. Keep **`vercel.json`** only if you still use Vercel for something unrelated.

## Local vs Render

| | Local | Vercel | Render (this setup) |
|---|--------|--------|---------------------|
| Video upload limit | ~500 MB | ~4.5 MB | ~500 MB (app limit) |
| Background launch flow | Supported | Poor fit / unsupported | Supported |
| SSE launch logs | Supported | Poor fit / unsupported | Supported |

## Troubleshooting

- **Build fails:** ensure root **`package-lock.json`** is committed; run `npm ci` locally from repo root to verify.
- **500 on launch:** check Render **Logs**; confirm `ANTHROPIC_API_KEY` is set and client JSON credentials are current.
- **"Meta token invalid":** Set **`META_ACCESS_TOKEN`** in Render dashboard to your Meta long-lived token. This overrides config and does not require a deploy. Get a token at [Graph API Explorer](https://developers.facebook.com/tools/explorer) → Generate → Extend to long-lived.
- **TikTok launch blocked in UI:** confirm the client JSON includes `tiktokLocationIds` and, for traffic clients, `tiktokWebsiteUrl`.
- **Meta launch blocked early:** confirm `metaPageId` is present and that `META_APP_ID` / `META_APP_SECRET` are set if you want pre-launch token validation.
