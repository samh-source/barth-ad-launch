# Barth on Render — Setup Checklist

After deploy, do this **once** in Render dashboard:

## Environment Variables (Dashboard → Your Service → Environment)

| Variable | Required | What to put |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Claude API key from [platform.claude.com](https://platform.claude.com) → Settings → API keys |
| `META_ACCESS_TOKEN` | Yes (for Meta) | Your Meta long-lived token. Get it: [Graph API Explorer](https://developers.facebook.com/tools/explorer) → select app → Generate Access Token → Extend to long-lived |
| `META_APP_ID` | No | App ID for token validation (optional) |
| `META_APP_SECRET` | No | App Secret for token validation (optional) |
| `TIKTOK_CLIENT_KEY` | For TikTok refresh | From TikTok for Developers |
| `TIKTOK_CLIENT_SECRET` | For TikTok refresh | From TikTok for Developers |

## Key: META_ACCESS_TOKEN

**This is the fix for "Meta token invalid".** Barth reads the token from this env var on Render. Update it in the dashboard when your token expires — no code push needed.

## After changing env vars

Click **Save Changes**. Render will redeploy. Wait for deploy to finish (~2 min).
