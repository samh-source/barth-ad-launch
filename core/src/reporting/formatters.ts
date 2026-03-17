import type { RunReport } from "./types.js";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a report as CSV. First row: headers. Then summary row, then one row per action, then performance if present.
 */
export function formatReportAsCsv(report: RunReport): string {
  const rows: string[][] = [];

  rows.push(["client", "agent", "run_at", "actions_count", "total_spend", "errors"].map(escapeCsv));
  rows.push(
    [
      report.clientName,
      report.agent,
      report.runAt,
      String(report.summary.actionsCount),
      report.summary.totalSpend != null ? String(report.summary.totalSpend) : "",
      report.summary.errors?.length ? report.summary.errors.join("; ") : "",
    ].map(escapeCsv)
  );

  if (report.actions.length > 0) {
    rows.push([]);
    rows.push(["action_timestamp", "action", "target_id", "target_name", "details"].map(escapeCsv));
    for (const a of report.actions) {
      rows.push(
        [
          a.timestamp,
          a.action,
          a.targetId ?? "",
          a.targetName ?? "",
          a.details ?? "",
        ].map(escapeCsv)
      );
    }
  }

  if (report.performance && report.performance.length > 0) {
    rows.push([]);
    const perfKeys = ["id", "name", "spend", "impressions", "conversions", "roas", "cpa"];
    rows.push(perfKeys.map(escapeCsv));
    for (const p of report.performance) {
      rows.push(
        perfKeys.map((k) => {
          const v = p[k];
          return escapeCsv(v != null ? String(v) : "");
        })
      );
    }
  }

  return rows.map((r) => r.join(",")).join("\n");
}

/**
 * Format a report as a simple HTML document for email or file.
 */
export function formatReportAsHtml(report: RunReport): string {
  const errorsHtml =
    report.summary.errors?.length ?
      `<p><strong>Errors:</strong> ${report.summary.errors.map((e) => escapeHtml(e)).join("; ")}</p>`
    : "";

  const actionsHtml =
    report.actions.length > 0
      ? `
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse;">
  <thead><tr><th>Time</th><th>Action</th><th>Target ID</th><th>Target Name</th><th>Details</th></tr></thead>
  <tbody>
${report.actions
  .map(
    (a) =>
      `    <tr><td>${escapeHtml(a.timestamp)}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.targetId ?? "")}</td><td>${escapeHtml(a.targetName ?? "")}</td><td>${escapeHtml(a.details ?? "")}</td></tr>`
  )
  .join("\n")}
  </tbody>
</table>`
      : "<p>No actions taken.</p>";

  const performanceHtml =
    report.performance && report.performance.length > 0
      ? `
<h3>Performance snapshot</h3>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse;">
  <thead><tr><th>ID</th><th>Name</th><th>Spend</th><th>Impressions</th><th>Conversions</th><th>ROAS</th><th>CPA</th></tr></thead>
  <tbody>
${report.performance
  .map(
    (p) =>
      `    <tr><td>${escapeHtml(String(p.id))}</td><td>${escapeHtml(p.name)}</td><td>${p.spend ?? ""}</td><td>${p.impressions ?? ""}</td><td>${p.conversions ?? ""}</td><td>${p.roas ?? ""}</td><td>${p.cpa ?? ""}</td></tr>`
  )
  .join("\n")}
  </tbody>
</table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Report: ${escapeHtml(report.clientName)}</title></head>
<body>
  <h1>Ad management report</h1>
  <p><strong>Client:</strong> ${escapeHtml(report.clientName)} | <strong>Agent:</strong> ${escapeHtml(report.agent)} | <strong>Run at:</strong> ${escapeHtml(report.runAt)}</p>
  <p><strong>Actions count:</strong> ${report.summary.actionsCount}${report.summary.totalSpend != null ? ` | <strong>Total spend:</strong> ${report.summary.totalSpend}` : ""}</p>
  ${errorsHtml}
  <h3>Actions</h3>
  ${actionsHtml}
  ${performanceHtml}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
