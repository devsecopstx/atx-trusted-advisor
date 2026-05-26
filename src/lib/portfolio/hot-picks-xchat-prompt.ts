import type { HotPickCard } from "@/modules/portfolios/hot-picks-types";

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "—";
  }
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
}

function formatSignedPct(n: number): string {
  if (!Number.isFinite(n)) {
    return "—";
  }
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function summarizeLegs(pick: HotPickCard): string | null {
  const legs = pick.legs.filter((l) => l.strike > 0);
  if (legs.length === 0) {
    return null;
  }
  return legs
    .map((l) => {
      const side = l.side?.trim() || "leg";
      const right = l.right === "put" ? "P" : l.right === "call" ? "C" : "?";
      const exp = l.expiryYmd?.slice(0, 10) ?? pick.expirationYmd?.slice(0, 10) ?? "";
      const qty = l.quantity != null && l.quantity !== 0 ? ` ×${Math.abs(l.quantity)}` : "";
      return `${side} ${l.strike}${right}${exp ? ` ${exp}` : ""}${qty}`;
    })
    .join("; ");
}

function rationaleSnippet(rationale: string): string {
  const trimmed = rationale.trim();
  if (!trimmed) {
    return "";
  }
  const first = trimmed.split(/(?<=\.)\s+/)[0]?.trim() ?? trimmed;
  return first.length > 220 ? `${first.slice(0, 217)}…` : first;
}

/** Composer seed from a Hot Picks scanner card (forward DTE structures). */
export function buildHotPickXchatPrompt(pick: HotPickCard): string {
  const legsLine = summarizeLegs(pick);
  const rationale = rationaleSnippet(pick.rationale);
  const exp = pick.expirationYmd?.slice(0, 10);

  const lines = [
    `I pulled this Hot Picks scanner card for ${pick.symbol}:`,
    `· Structure: ${pick.strategyLabel}${exp ? ` · exp ${exp}` : ""} · ${pick.contractLabel}`,
    `· Outlook: ${pick.outlook} · Edge score: ${pick.edgeScore}`,
    `· Entry ${formatUsd(pick.entry)} · Breakeven ${formatUsd(pick.breakeven)} · POP ${pick.popPercent.toFixed(0)}% · Est. ROI ${formatSignedPct(pick.estRoiPercent)} · IV rank ${pick.ivRankPercent.toFixed(0)}%`,
    `· Payoff band: max gain ${formatSignedPct(pick.maxGainPercent)} · max loss ${formatSignedPct(pick.maxLossPercent)}`
  ];

  if (legsLine) {
    lines.push(`· Legs: ${legsLine}`);
  }
  if (rationale) {
    lines.push(`· Scanner note: ${rationale}`);
  }

  lines.push(
    "Walk me through whether this fits my book, defined-risk sizing, and what would change the thesis before I open the strategy builder."
  );

  return lines.join("\n");
}
