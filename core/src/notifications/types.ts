export type NotificationChannel = "email";

/** Payload for token-related alerts (expiring soon, refresh failed) */
export interface TokenAlertPayload {
  clientName: string;
  platform: "meta" | "tiktok";
  message: string;
  /** Optional: ISO date when token expires */
  expiresAt?: string;
}

/** Payload for a generic alert (errors, threshold breach) */
export interface AlertPayload {
  clientName: string;
  subject: string;
  body: string;
  /** Optional agent name */
  agent?: string;
}

/** Payload for sending a report (e.g. daily summary HTML) */
export interface ReportEmailPayload {
  to: string;
  subject: string;
  html: string;
  clientName?: string;
}
