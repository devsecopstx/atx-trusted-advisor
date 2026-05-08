export type DeskPreviewEvent = {
  readonly title: string;
  readonly body?: string;
  readonly symbol?: string;
};

/**
 * Branded HTML preview for desk notifications. Production email channels currently send **plain text**
 * via {@link dispatchPortfolioDeskEvents}; this preview matches that copy for operator trust checks.
 */
export function buildDeskNotificationEmailPreviewHtml(
  events: ReadonlyArray<DeskPreviewEvent>,
  subject = "aTx Finance — desk alerts"
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const rows = events.map((e) => {
    const sym = e.symbol?.trim() ? ` ${esc(e.symbol.trim())}` : "";
    const body = e.body?.trim() ? `<div class="evt-body">${esc(e.body.trim())}</div>` : "";
    return `<div class="evt"><div class="evt-title">${esc(e.title)}${sym}</div>${body}</div>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(subject)}</title>
<style>
body{margin:0;background:#050505;color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;}
.wrap{max-width:560px;margin:0 auto;border-radius:16px;border:1px solid rgba(57,255,20,0.22);background:linear-gradient(165deg,rgba(24,24,27,0.95),rgba(9,9,11,0.98));padding:22px 22px 18px;box-shadow:0 0 42px -18px rgba(57,255,20,0.35);}
.brand{font-weight:800;letter-spacing:0.06em;font-size:11px;color:#39ff14;text-transform:uppercase;margin:0 0 14px;}
.sub{font-size:13px;color:#94a3b8;margin:0 0 18px;line-height:1.45;}
.evt{border-top:1px solid rgba(148,163,184,0.15);padding:14px 0 2px;}
.evt:first-of-type{border-top:none;padding-top:0;}
.evt-title{font-weight:700;font-size:15px;color:#f8fafc;}
.evt-body{margin-top:6px;font-size:13px;color:#cbd5e1;line-height:1.45;white-space:pre-wrap;}
.foot{margin-top:18px;font-size:11px;color:#64748b;line-height:1.4;}
</style></head><body><div class="wrap"><p class="brand">aTx⚡Finance · desk preview</p>
<p class="sub">${esc(subject)} · ${events.length} event${events.length === 1 ? "" : "s"}</p>
${rows.join("")}
<p class="foot">Illustrative HTML styling. Live SMTP delivery uses the same wording as plain text until HTML templates are enabled.</p>
</div></body></html>`;
}
