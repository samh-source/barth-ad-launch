# Client configs

Place one JSON file per client in this directory. Only `.json` files are loaded.

## Required

- **clientName** (string) – Display name for logs and reports.

## Optional – Meta

- **metaAccountId** – Meta ad account ID (e.g. `act_123`).
- **metaAccessToken** – Meta long-lived access token.
- **metaPageId** – Facebook Page ID (required for Barth video ads).
- **metaWebsiteUrl** – Optional website URL for the ad CTA (Barth).
- **metaTokenExpiresAt** – ISO date when the token expires (for refresh and alerts).
- **metaTargeting** – Geo targeting for Barth: advertise within a radius of each business location. Example (10-mile radius around one point):

```json
"metaTargeting": {
  "geo_locations": {
    "countries": ["US"],
    "custom_locations": [
      {
        "latitude": 40.7128,
        "longitude": -74.006,
        "radius": 10,
        "distance_unit": "mile"
      }
    ]
  }
}
```

Use the latitude/longitude of the business (e.g. from Google Maps: right-click the pin → coordinates). Add one `custom_locations` entry per location; `radius` defaults to 10 miles if omitted.

If either `metaAccountId` or `metaAccessToken` is set, both must be set.

## Optional – TikTok

- **tiktokAdvertiserId** – TikTok advertiser ID.
- **tiktokAccessToken** – TikTok access token.
- **tiktokRefreshToken** – Required for auto-refreshing the access token.
- **tiktokRefreshTokenExpiresAt** – ISO date when the refresh token expires.
- **tiktokLaunchMode** – Barth TikTok launch default: `website_traffic` or `awareness`.
- **tiktokLocationIds** – TikTok location IDs used for Barth's default geo targeting. TikTok uses location IDs instead of Meta-style radius targeting.
- **tiktokWebsiteUrl** – Landing page URL for `website_traffic` launches.

If either `tiktokAdvertiserId` or `tiktokAccessToken` is set, both must be set.

For Barth TikTok launches, `tiktokLaunchMode` controls the default launch path:

- `website_traffic` requires `tiktokWebsiteUrl`
- `awareness` does not require a landing page URL
- all TikTok launches require `tiktokLocationIds`

## Optional – Other

- **notificationEmail** – Email for alerts and reports.
- **thresholds** – Object with e.g. `minROAS`, `maxCPA`, `minSpendToEvaluate`, `minConversionsToEvaluate`.

## Example

```json
{
  "clientName": "Acme Corp",
  "notificationEmail": "ads@acme.com",
  "metaAccountId": "act_123456",
  "metaAccessToken": "...",
  "metaTokenExpiresAt": "2025-05-01T00:00:00.000Z",
  "tiktokAdvertiserId": "7123456789",
  "tiktokAccessToken": "...",
  "tiktokLocationIds": ["501"],
  "tiktokRefreshToken": "...",
  "tiktokRefreshTokenExpiresAt": "2026-01-01T00:00:00.000Z",
  "thresholds": {
    "minROAS": 2,
    "maxCPA": 50,
    "minSpendToEvaluate": 100
  }
}
```

Some clients may have only Meta, only TikTok, or both. The system skips missing platforms per client.
