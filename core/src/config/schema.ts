/**
 * JSON Schema for client config files (optional use for validation or docs).
 * Not used at runtime by the loader; loader has its own validation.
 */
export const clientConfigSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["clientName"],
  properties: {
    clientName: { type: "string", minLength: 1 },
    notificationEmail: { type: "string", format: "email" },
    metaAccountId: { type: "string" },
    metaAccessToken: { type: "string" },
    metaTokenExpiresAt: { type: "string", format: "date-time" },
    tiktokAdvertiserId: { type: "string" },
    tiktokAccessToken: { type: "string" },
    tiktokRefreshToken: { type: "string" },
    tiktokRefreshTokenExpiresAt: { type: "string", format: "date-time" },
    thresholds: {
      type: "object",
      properties: {
        minROAS: { type: "number" },
        maxCPA: { type: "number" },
        minSpendToEvaluate: { type: "number" },
        minConversionsToEvaluate: { type: "number" },
      },
    },
  },
} as const;
