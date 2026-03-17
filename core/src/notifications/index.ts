import nodemailer from "nodemailer";
import type { AlertPayload, ReportEmailPayload, TokenAlertPayload } from "./types.js";

export type { AlertPayload, ReportEmailPayload, TokenAlertPayload } from "./types.js";

function getSmtpConfig(): { host: string; port: number; secure: boolean; user: string; pass: string; from: string } | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  return { host, port, secure, user, pass, from };
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;
  const config = getSmtpConfig();
  if (!config) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return transporter;
}

/**
 * Send a single email. No-ops if SMTP is not configured (logs to console in dev).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.warn("Notifications: SMTP not configured (SMTP_HOST, SMTP_FROM). Email not sent.");
    }
    return { sent: false };
  }
  const config = getSmtpConfig();
  const from = params.from ?? config?.from ?? "noreply@localhost";
  try {
    await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? params.html.replace(/<[^>]+>/g, ""),
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, error: message };
  }
}

/**
 * Send a token expiring / refresh failed alert. Uses client's notificationEmail or ADMIN_EMAIL.
 */
export async function sendTokenAlert(
  payload: TokenAlertPayload,
  options: { notificationEmail?: string } = {}
): Promise<{ sent: boolean; error?: string }> {
  const to = options.notificationEmail ?? process.env.ADMIN_EMAIL?.trim();
  if (!to) {
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.warn(`Notifications: No recipient for token alert (client: ${payload.clientName}). Set notificationEmail in client config or ADMIN_EMAIL.`);
    }
    return { sent: false };
  }
  const subject = `[Ad Manager] Token alert: ${payload.platform} for ${payload.clientName}`;
  const html = `
    <p><strong>Client:</strong> ${escapeHtml(payload.clientName)}</p>
    <p><strong>Platform:</strong> ${payload.platform}</p>
    <p><strong>Message:</strong> ${escapeHtml(payload.message)}</p>
    ${payload.expiresAt ? `<p><strong>Expires at:</strong> ${escapeHtml(payload.expiresAt)}</p>` : ""}
  `.trim();
  return sendEmail({ to, subject, html });
}

/**
 * Send a generic alert (errors, threshold breach). Uses client's notificationEmail or ADMIN_EMAIL.
 */
export async function sendAlert(
  payload: AlertPayload,
  options: { notificationEmail?: string } = {}
): Promise<{ sent: boolean; error?: string }> {
  const to = options.notificationEmail ?? process.env.ADMIN_EMAIL?.trim();
  if (!to) {
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.warn(`Notifications: No recipient for alert (client: ${payload.clientName}). Set notificationEmail or ADMIN_EMAIL.`);
    }
    return { sent: false };
  }
  const subject = `[Ad Manager] ${payload.subject}`;
  const html = `
    <p><strong>Client:</strong> ${escapeHtml(payload.clientName)}</p>
    ${payload.agent ? `<p><strong>Agent:</strong> ${escapeHtml(payload.agent)}</p>` : ""}
    <p>${escapeHtml(payload.body).replace(/\n/g, "<br>")}</p>
  `.trim();
  return sendEmail({ to, subject, html });
}

/**
 * Send a report email (e.g. daily summary HTML).
 */
export async function sendReportEmail(payload: ReportEmailPayload): Promise<{ sent: boolean; error?: string }> {
  return sendEmail({
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
