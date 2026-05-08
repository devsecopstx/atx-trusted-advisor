function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildUserPriceAlertEmailHtml(input: {
  symbol: string;
  ruleKind: string;
  targetPriceUsd: number;
  spotPrice: number;
  alertsUrl: string;
}): string {
  const sym = escapeHtml(input.symbol);
  const kind = escapeHtml(input.ruleKind);
  const target = input.targetPriceUsd.toFixed(2);
  const spot = input.spotPrice.toFixed(2);
  const url = escapeHtml(input.alertsUrl);
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#050505;color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050505;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#0f172a;border-radius:12px;border:1px solid #1e293b;">
          <tr>
            <td style="padding:28px 24px 8px 24px;font-size:20px;font-weight:800;letter-spacing:0.08em;color:#39ff14;text-transform:uppercase;">
              aTx<span style="color:#eab308;">⚡</span>Finance
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 4px 24px;font-size:15px;font-weight:600;color:#94a3b8;">
              Price alert triggered
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 20px 24px;font-size:15px;line-height:1.5;color:#cbd5e1;">
              <strong style="color:#39ff14;">${sym}</strong> crossed your <strong>${kind}</strong> rule at
              <strong>$${target}</strong> (last quote ~$${spot}).
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px 24px;">
              <a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:8px;background-color:#22c55e;color:#050505;font-weight:700;text-decoration:none;">
                Open portfolio alerts
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;font-size:12px;color:#64748b;line-height:1.4;">
              No atoms moved. Just gains earned. Not financial advice — desk notification only.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildUserPriceAlertEmailText(input: {
  symbol: string;
  ruleKind: string;
  targetPriceUsd: number;
  spotPrice: number;
  alertsUrl: string;
}): string {
  return [
    `aTx⚡Finance — price alert`,
    `${input.symbol} (${input.ruleKind}) crossed $${input.targetPriceUsd.toFixed(2)}; last quote ~$${input.spotPrice.toFixed(2)}.`,
    `Alerts: ${input.alertsUrl}`,
    "",
    "Not financial advice — desk notification only."
  ].join("\n");
}
