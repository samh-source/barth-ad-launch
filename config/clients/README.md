# Client configs

Place one JSON file per client in this directory. Only `.json` files are loaded.

## Required

- **clientName** (string) – Display name for logs and reports.

## Optional – Meta

- **metaAccountId** – Meta ad account ID (e.g. `act_123`).
- **metaAccessToken** – Meta long-lived access token.
- **metaTokenExpiresAt** – ISO date when the token expires (for refresh and alerts).

If either `metaAccountId` or `metaAccessToken` is set, both must be set.

## Optional – TikTok

- **tiktokAdvertiserId** – TikTok advertiser ID.
- **tiktokAccessToken** – TikTok access token.
- **tiktokRefreshToken** – Required for auto-refreshing the access token.
- **tiktokRefreshTokenExpiresAt** – ISO date when the refresh token expires.

If either `tiktokAdvertiserId` or `tiktokAccessToken` is set, both must be set.

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
