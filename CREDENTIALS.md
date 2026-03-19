# Credentials Setup Guide

This guide walks you through gathering every credential the system needs and where to put it. You need **app-level** credentials (in `.env`) and **per-client** credentials (in `config/clients/<client>.json`).

---

## Part 1: Meta (Facebook) Credentials

### What you need

| What | Where it goes | Used for |
|------|----------------|----------|
| **App ID** | `.env` as `META_APP_ID` | Token debug and refresh |
| **App Secret** | `.env` as `META_APP_SECRET` | Token debug and refresh |
| **Ad account ID** | `config/clients/<client>.json` as `metaAccountId` | Which ad account the agent manages |
| **Long-lived access token** | `config/clients/<client>.json` as `metaAccessToken` | API calls to the Marketing API |
| **Facebook Page ID** (optional) | `config/clients/<client>.json` as `metaPageId` | **Required for Barth** video launches (video ad creatives must be associated with a Page) |

---

### Step 1: Create a Meta app and get App ID and App Secret

1. Go to **[developers.facebook.com](https://developers.facebook.com)** and log in.
2. Click **My Apps** (top right), then **Create App**.
3. Choose **Other** → **Business** (or **Consumer** if you prefer), then **Next**.
4. Enter an **App name** and **App contact email**, then **Create app**.
5. On the app dashboard, go to **Settings** → **Basic**.
6. Note:
   - **App ID** → this is your `META_APP_ID`.
   - **App Secret** → click **Show**, then copy. This is your `META_APP_SECRET`. Store it securely and never commit it to git.

**Add the Marketing API product (if required):**

7. In the left sidebar, click **Add Products** (or **App products**).
8. Find **Marketing API** and click **Set up**.
9. Complete any prompts (e.g. Business Manager link if asked).

---

### Step 2: Get your ad account ID (metaAccountId)

1. Go to **[Meta Ads Manager](https://adsmanager.facebook.com)** (or business.facebook.com → Ads Manager).
2. In the top bar, open the **account dropdown** (where your ad account name is shown).
3. Your **ad account name** and **ID** are listed there. The ID is a long number, often shown as **act_1234567890123456**.
   - You can also look at the URL when viewing campaigns: `...?act=1234567890123456`. Use that number with or without the `act_` prefix (the agent accepts both).
4. Copy this **ad account ID** — you’ll use it as `metaAccountId` in each client config that uses Meta.

---

### Step 3: Generate a long-lived access token (metaAccessToken)

1. Go to **[Graph API Explorer](https://developers.facebook.com/tools/explorer)**.
2. At the top, select **your app** from the “Meta App” dropdown.
3. Click **Generate Access Token** (or “Add a Permission” first).
4. In the **Permissions** tab, add at least:
   - **ads_management**
   - **ads_read**
   - **business_management** (if you use Business Manager)
5. Click **Generate Access Token** and complete the Facebook login and permission prompts.
6. After you get the token, in the **Access Token Info** section click **Extend Access Token** (or “Get long-lived token”) to convert it to a **long-lived** token (~60 days).
7. Copy the **long-lived access token** — this is `metaAccessToken` for that client.

**Optional (recommended for production):** Use a **System User** in Meta Business Manager to generate a token that doesn’t expire. See [Meta’s System User docs](https://developers.facebook.com/docs/marketing-api/system-users/). The agent supports both user and system user tokens.

---

### Step 4: Where to put Meta credentials

**In `.env` (project root, one per environment):**

```env
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
```

**In `config/clients/<client>.json` (one file per client):**

```json
{
  "clientName": "Acme Corp",
  "notificationEmail": "ads@acme.com",
  "metaAccountId": "act_1234567890123456",
  "metaAccessToken": "EAAxxxx...your_long_lived_token_here",
  "metaPageId": "123456789012345",
  "thresholds": {
    "minROAS": 2,
    "maxCPA": 50,
    "minSpendToEvaluate": 100
  }
}
```

- Use the **same** `META_APP_ID` and `META_APP_SECRET` for all clients.
- Each client that uses Meta has its own `metaAccountId` and `metaAccessToken` (one token per user/ad account you’re managing).

---

**Meta token expired?** Long-lived user tokens last ~60 days. If Barth reports "Meta token invalid or revoked", regenerate a token (Step 3 above) and update `metaAccessToken` in the client JSON. For production, use a **System User** token—it doesn't expire.

---

## Part 2: TikTok Credentials

### What you need

| What | Where it goes | Used for |
|------|----------------|----------|
| **Client Key** | `.env` as `TIKTOK_CLIENT_KEY` | OAuth and token refresh |
| **Client Secret** | `.env` as `TIKTOK_CLIENT_SECRET` | OAuth and token refresh |
| **Advertiser ID** | `config/clients/<client>.json` as `tiktokAdvertiserId` | Which ad account the agent manages |
| **Access token** | `config/clients/<client>.json` as `tiktokAccessToken` | API calls (refreshed automatically) |
| **Refresh token** | `config/clients/<client>.json` as `tiktokRefreshToken` | Getting new access tokens without re-login |
| **Location IDs** | `config/clients/<client>.json` as `tiktokLocationIds` | TikTok-supported geographic targeting for Barth launches |

---

### Step 1: Create a TikTok for Business app and get Client Key and Client Secret

1. Go to **[TikTok for Developers](https://developers.tiktok.com)** or **[TikTok API for Business](https://business-api.tiktok.com/portal)** and log in (use the account that will manage ads).
2. Open your **profile** (top right) → **Manage apps** (or **Manage applications**).
3. Click **Connect an app** (or **Create an app**) and fill in:
   - App name, description, category.
   - Add the **Marketing API** (or **TikTok Ads API**) product.
4. After the app is created, open it and go to **Credentials** / **App details**.
5. Note:
   - **Client Key** → `TIKTOK_CLIENT_KEY`
   - **Client Secret** → `TIKTOK_CLIENT_SECRET` (store securely, never commit).
6. Under **Redirect URI**, add a callback URL (e.g. `https://yourdomain.com/callback` or `http://localhost:3000/callback` for local testing). You’ll need this for the OAuth flow in the next step.

---

### Step 2: Get your TikTok advertiser ID (tiktokAdvertiserId)

1. Go to **[TikTok Ads Manager](https://ads.tiktok.com)**.
2. Click your **username** (top right) → the dropdown lists your **ad accounts** and their **IDs**.
3. The **ad account ID** is a **19-digit number**. Copy it — this is `tiktokAdvertiserId`.
   - You can also see it in the URL when using Ads Manager (e.g. `advertiser_id=7123456789012345678`).

---

### Step 3: Get an access token and refresh token (OAuth)

The first time you connect an advertiser, you must complete the **OAuth flow** once to get `access_token` and `refresh_token`. After that, the agent refreshes the access token automatically.

**Option A: Use a one-time script or tool**

1. Build the authorization URL:
   - Endpoint: `https://www.tiktok.com/auth/authorize/` (or the URL shown in your TikTok app’s “Authorization” docs).
   - Query params: `client_key=<TIKTOK_CLIENT_KEY>`, `scope=<scopes>`, `response_type=code`, `redirect_uri=<your_redirect_uri>`, `state=random_string`.
   - Scopes: include at least `ad_management`, `report_scope` (or the scopes required by the Marketing API for your app).
2. Open that URL in a browser, log in to TikTok, and approve the app. TikTok will redirect to your `redirect_uri` with `?code=...&state=...`.
3. Exchange the `code` for tokens:
   - `POST https://open.tiktokapis.com/v2/oauth/token/`
   - Body (form): `client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`.
4. Response will include `access_token`, `refresh_token`, and `expires_in`. Save both tokens for this client.

**Option B: Use TikTok’s “Get access” / testing tools (if available)**

- Some TikTok developer portals offer a “Get access” or “Generate token” flow that returns an authorization URL and, after you approve, shows or returns the access and refresh tokens. Use that and copy both into the client config.

**Scopes:** Ensure your app requests the scopes needed for the Marketing API (e.g. managing campaigns, ad groups, ads, and reports). Exact scope names are in [TikTok’s OAuth docs](https://developers.tiktok.com/doc/oauth-user-access-token-management).

---

### Step 4: Where to put TikTok credentials

**In `.env` (project root):**

```env
TIKTOK_CLIENT_KEY=your_client_key_here
TIKTOK_CLIENT_SECRET=your_client_secret_here
```

**In `config/clients/<client>.json`:**

```json
{
  "clientName": "Acme Corp",
  "notificationEmail": "ads@acme.com",
  "tiktokAdvertiserId": "7123456789012345678",
  "tiktokAccessToken": "act.xxxx...",
  "tiktokLocationIds": ["501"],
  "tiktokRefreshToken": "rft.xxxx...",
  "thresholds": {
    "minROAS": 2,
    "maxCPA": 50,
    "minSpendToEvaluate": 100
  }
}
```

- Use the **same** `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` for all clients.
- Each client that uses TikTok has its own `tiktokAdvertiserId`, `tiktokAccessToken`, and `tiktokRefreshToken`.
- For Barth launches, each TikTok client also needs `tiktokLocationIds`.
- TikTok geographic targeting uses platform `location_ids`, not Meta-style latitude/longitude radius input.

---

## Part 3: Shared and optional credentials

**In `.env`:**

| Variable | Required for | Description |
|----------|--------------|-------------|
| `ANTHROPIC_API_KEY` | Both agents (copy/decisions) | From [Anthropic Console](https://console.anthropic.com) → API keys |
| `SMTP_HOST`, `SMTP_FROM`, etc. | Email alerts | Optional; for token/error and report emails |
| `ADMIN_EMAIL` | Fallback for alerts | Used when a client has no `notificationEmail` |
| `META_AGENT_CRON` | Meta agent | Optional; default `0 */6 * * *` (every 6 hours) |
| `TIKTOK_AGENT_CRON` | TikTok agent | Optional; default `0 */6 * * *` |
| `REPORTS_DIR` | Report files | Optional; default `reports` |

## Part 4: Render deploy env checklist

For the deployed `Barth` app on `Render`, set:

- `ANTHROPIC_API_KEY`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`

Production `Barth` reads the checked-in `config/clients/*.json` files at runtime, so the branch you deploy must contain the current real client configs.

## Part 5: Per-client checklist

**In each `config/clients/<client>.json`:**

- **clientName** — Required. Display name in logs and reports.
- **notificationEmail** — Optional. Email for token alerts, run errors, and reports.
- **thresholds** — Optional. `minROAS`, `maxCPA`, `minSpendToEvaluate`, `minConversionsToEvaluate` for pause and budget logic.

A client can have **only Meta**, **only TikTok**, or **both**. Omit the Meta or TikTok fields for clients that don’t use that platform.

---

## Part 6: Quick checklist

**Meta (per environment):**

- [ ] Meta app created; **App ID** and **App Secret** in `.env` as `META_APP_ID`, `META_APP_SECRET`
- [ ] For each Meta client: **ad account ID** and **long-lived access token** in `config/clients/<client>.json` as `metaAccountId`, `metaAccessToken`

**TikTok (per environment):**

- [ ] TikTok app created; **Client Key** and **Client Secret** in `.env` as `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
- [ ] Redirect URI set in the TikTok app (for OAuth)
- [ ] For each TikTok client: **advertiser ID**, **access token**, and **refresh token** from one OAuth flow in `config/clients/<client>.json` as `tiktokAdvertiserId`, `tiktokAccessToken`, `tiktokRefreshToken`
- [ ] For each TikTok client used by Barth: `tiktokLocationIds`
- [ ] For each TikTok website-traffic client used by Barth: `tiktokWebsiteUrl`

**Shared:**

- [ ] `ANTHROPIC_API_KEY` in `.env` if you use Claude (copy/decisions)
- [ ] Optional: SMTP and `ADMIN_EMAIL` for alerts; cron and `REPORTS_DIR` if you want to override defaults

Never commit `.env` or real tokens to version control. Use `.gitignore` (the repo already ignores `.env`) and restrict permissions on `config/clients/` in production.

Do not use `Vercel` for production Barth video launches; use `Render` for the hosted upload flow.
