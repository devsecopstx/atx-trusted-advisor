import type { AuditEvent } from "@/modules/audit/types";

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** RFC4180-style single-line CSV rows from bootstrap audit events (UTF-8). */
export function bootstrapAuditEventsToCsv(events: readonly AuditEvent[]): string {
  const header =
    "createdAt,actorUserId,actorEmail,trigger,platformRole,success,portfolioId,errorSnippet";
  const lines = [header];
  for (const ev of events) {
    const d = ev.details ?? {};
    const trigger = typeof d.trigger === "string" ? d.trigger : "";
    const platformRole = typeof d.platformRole === "string" ? d.platformRole : "";
    const success = d.success === true ? "true" : d.success === false ? "false" : "";
    const portfolioId = typeof d.portfolioId === "string" ? d.portfolioId : "";
    const errRaw = typeof d.error === "string" ? d.error : "";
    const errSnippet = errRaw.slice(0, 500);
    lines.push(
      [
        csvEscape(ev.createdAt.toISOString()),
        csvEscape(ev.actor?.userId ?? ""),
        csvEscape(ev.actor?.email ?? ""),
        csvEscape(trigger),
        csvEscape(platformRole),
        csvEscape(success),
        csvEscape(portfolioId),
        csvEscape(errSnippet)
      ].join(",")
    );
  }
  return lines.join("\r\n");
}
