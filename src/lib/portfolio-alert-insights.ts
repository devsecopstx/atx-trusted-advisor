/** Parse DTE from options-scanner style body/title (e.g. "6 DTE", "DTE 3"). */
export function parseAlertDte(body: string | null | undefined, title: string): number | null {
  const hay = `${title}\n${body ?? ""}`;
  const m1 = hay.match(/\b(\d+)\s*DTE\b/i);
  if (m1) {
    const n = Number.parseInt(m1[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }
  const m2 = hay.match(/\bDTE\s*(\d+)\b/i);
  if (m2) {
    const n = Number.parseInt(m2[1]!, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type AlertDteBucketId = "0-7" | "8-21" | "22-45" | "46+" | "unknown";

export function alertDteBucket(dte: number | null): AlertDteBucketId {
  if (dte === null || !Number.isFinite(dte)) {
    return "unknown";
  }
  if (dte <= 7) {
    return "0-7";
  }
  if (dte <= 21) {
    return "8-21";
  }
  if (dte <= 45) {
    return "22-45";
  }
  return "46+";
}

/** Short line for severity column: DTE, P/L, IV hints from scanner copy. */
export function extractAlertQuantSnippet(body: string | null | undefined, title: string): string {
  const raw = `${title}\n${body ?? ""}`.replace(/\r/g, "");
  const parts: string[] = [];
  const dte = parseAlertDte(body, title);
  if (dte !== null) {
    parts.push(`DTE ${dte}`);
  }
  const pl =
    raw.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:P\/L|P&L|loss|gain)/i) ??
    raw.match(/(?:P\/L|P&L)\s*[:\s]*(-?\d+(?:\.\d+)?)\s*%/i) ??
    raw.match(/Unrealized\s+(-?\d+(?:\.\d+)?)\s*%/i);
  if (pl) {
    const v = pl[1];
    parts.push(`${v}% P/L`);
  }
  const iv = raw.match(/IV\s*(\d+(?:\.\d+)?)\s*%/i);
  if (iv && parts.length < 3) {
    parts.push(`IV ${iv[1]}%`);
  }
  if (parts.length === 0) {
    const first = (body ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("[") && !l.startsWith("Option scanner"));
    if (first && first.length <= 96) {
      return first;
    }
    return title.length > 90 ? `${title.slice(0, 87)}…` : title;
  }
  return parts.slice(0, 3).join(" · ");
}

export type AlertRiskKind = "exit_pressure" | "income_theta" | "price_move" | "general";

export function inferAlertRiskKind(
  severity: string,
  body: string | null | undefined,
  title: string
): AlertRiskKind {
  const t = `${title} ${body ?? ""}`.toLowerCase();
  if (t.includes("buy_to_close") || t.includes("sell_to_close") || t.includes("exit") || t.includes("cut loss")) {
    return "exit_pressure";
  }
  if (t.includes("theta") || t.includes("roll") || t.includes("credit") || t.includes("premium")) {
    return "income_theta";
  }
  if (t.includes("price") && t.includes("alert")) {
    return "price_move";
  }
  if (severity === "critical") {
    return "exit_pressure";
  }
  return "general";
}

export function isOptionStyleAlert(title: string, body: string | null | undefined): boolean {
  const b = body ?? "";
  return (
    title.toLowerCase().includes("option scanner") ||
    /\[close:(BUY_TO_CLOSE|SELL_TO_CLOSE)\]/i.test(b) ||
    /\[afp:/i.test(b)
  );
}
