import type { AccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";

/** Serializable desk outlook for xChat shell SSR (composer badge + warm path). */
export type XchatInitialOutlookDesk = {
  portfolioId: string;
  marketOutlookLabel: string | null;
  riskLevelLabel: string | null;
  lastOutlookRefreshAt: string | null;
};

export function serializeOutlookDeskForXchatShell(
  portfolioIdHex: string,
  ctx: AccountOutlookContextForXchat | null
): XchatInitialOutlookDesk | null {
  if (!ctx) {
    return null;
  }
  return {
    portfolioId: portfolioIdHex,
    marketOutlookLabel: ctx.marketOutlookLabel ?? null,
    riskLevelLabel: ctx.riskLevelLabel ?? null,
    lastOutlookRefreshAt:
      ctx.lastOutlookRefreshAt && !Number.isNaN(ctx.lastOutlookRefreshAt.getTime())
        ? ctx.lastOutlookRefreshAt.toISOString()
        : null
  };
}

export function formatOutlookFreshnessLabel(
  input: {
    marketOutlookLabel: string | null;
    lastOutlookRefreshAt: string | null;
  },
  nowMs: number = Date.now()
): string | null {
  const age = formatOutlookAgeLabel(input.lastOutlookRefreshAt, nowMs);
  const outlook = input.marketOutlookLabel?.trim();
  if (!age && !outlook) {
    return null;
  }
  if (age && outlook) {
    return `Outlook ${outlook} · refreshed ${age}`;
  }
  if (age) {
    return `Outlook refreshed ${age}`;
  }
  return outlook ? `Outlook ${outlook}` : null;
}

export function formatOutlookAgeLabel(iso: string | null, nowMs: number = Date.now()): string | null {
  if (!iso) {
    return null;
  }
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  const minutes = Math.max(0, Math.floor((nowMs - at.getTime()) / 60_000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours} hr ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}
