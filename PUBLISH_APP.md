# Publishing Your Meta App (Go Live)

To fix the error **"Ads creative post was created by an app that is in development mode. It must be in public to create this ad"**, you need to publish your app in Meta for Developers.

## 1. Privacy policy URL (required)

Meta requires a **public** URL to your app’s privacy policy (e.g. `https://yourdomain.com/privacy`).

- **Option A — Use your own site:** Upload the file `barth/public/privacy.html` to your website and use that URL (e.g. `https://yoursite.com/privacy` or `https://yoursite.com/barth-privacy.html`).
- **Option B — Use Barth’s URL:** If Barth is already hosted on a public URL (e.g. `https://barth.yourcompany.com`), the privacy page is at `https://barth.yourcompany.com/privacy.html`. Use that as the Privacy policy URL.

In Meta: **App dashboard → Publish** (or **App Settings → Basic**) → set **Privacy policy URL** to that public URL → save.

## 2. Use cases

On the **Publish** page, Meta lists use cases (e.g. “Create & manage ads with Marketing API”). You don’t need to “add” them again if they’re already there. If any show as incomplete, open each one and complete the requested steps (e.g. permissions, descriptions). For standard Marketing API use, the defaults are usually enough.

## 3. Publish

When **Privacy policy URL** is set and use cases look complete, click the blue **Publish** button on the Publish page. Meta may show a short confirmation. After that, the app is **Live** and you can create ads without the development-mode error.

## 4. If Publish is disabled

If **Publish** is greyed out or blocked:

- Ensure **Privacy policy URL** is a real, public URL (not `localhost`).
- In **App Review**, check that the permissions you use (e.g. `ads_management`, `pages_manage_ads`) are approved or allowed for your app type.
- Fill in any other required fields in **App Settings → Basic** (e.g. app icon, category) if Meta asks for them.

After the app is Live, run Barth again and launch for Sessco; no code changes are needed.
