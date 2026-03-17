# Deploy Barth to Vercel

Deploy Barth so you get a **public URL** (e.g. for Meta’s Privacy policy URL). After deployment, use:

**Privacy policy URL for Meta:** `https://<your-project>.vercel.app/privacy.html`

---

## 1. Push your repo to GitHub

If it isn’t already:

- Create a repo on GitHub.
- Push this project (or connect an existing repo).

---

## 2. Import the project in Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in (GitHub is fine).
2. Click **Add New…** → **Project**.
3. **Import** the GitHub repo that contains this code (e.g. `cursor meta and tik tok agents` or whatever you named it).
4. Leave **Root Directory** as **.** (project root).
5. **Build and Output Settings** (Vercel should use these from `vercel.json`):
   - **Build Command:** `npm run build:core && npm run build -w barth`
   - **Output Directory:** leave empty (we use a serverless function, not static export).
6. Click **Deploy**. The first deploy may take a couple of minutes.

---

## 3. Set environment variables (for Launch to work)

After the first deploy:

1. In Vercel: open your project → **Settings** → **Environment Variables**.
2. Add the same vars you use locally (from `.env`), at least:
   - `ANTHROPIC_API_KEY` (for Claude captions)
   - `META_APP_ID`, `META_APP_SECRET` (if you use token refresh)
   - Any others your app reads from `process.env`.
3. **Redeploy** (Deployments → … on latest → Redeploy) so the new env vars are used.

Your **client config** (e.g. `config/clients/sessco.json`) is in the repo, so tokens there are deployed too. If you prefer not to put tokens in the repo, you’d need to move config to env or a secret store and change the code; for now, having them in the repo is enough to get a public URL and test Launch.

---

## 4. Get your public URL

After a successful deploy:

- Vercel gives you a URL like **`https://your-project-name.vercel.app`**.
- The privacy policy is at: **`https://your-project-name.vercel.app/privacy.html`**.

Use that **privacy URL** in Meta: **App dashboard → Publish (or App settings) → Privacy policy URL** → paste it → save, then click **Publish**.

---

## 5. Limits to be aware of

- **Timeout:** The Launch flow (video upload, Claude, Meta campaign/ad set/creative/ad) can take 30–60+ seconds. Vercel’s serverless function has a **max duration** (e.g. 60s on Pro). If you hit timeouts, run Barth locally for Launch and use Vercel mainly for the public site and privacy URL, or upgrade Vercel for longer limits.
- **Request size:** Large video uploads may hit Vercel’s body size limit (e.g. 4.5 MB on Hobby). For big videos, run Barth locally or host it on a platform without that limit (e.g. Railway, Render).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Push project to GitHub |
| 2 | Vercel → Add New → Project → Import repo → Deploy |
| 3 | Settings → Environment Variables → add `ANTHROPIC_API_KEY` (and any other .env vars) → Redeploy |
| 4 | Copy `https://<your-project>.vercel.app/privacy.html` |
| 5 | Meta App → Publish / App settings → Privacy policy URL → paste → Publish app |

After that, your app is public and you can use the privacy URL for Meta.
