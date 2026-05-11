import { createHash } from "node:crypto";

import { listPortfolioAccounts } from "@/modules/core-admin/repository";
import {
    accountOutlookDisplayLabel,
    type Account,
    type AccountOutlook
} from "@/modules/core-admin/types";
import {
    buildAccountOutlookContextCacheKey,
    getAccountOutlookContextCacheTtlSeconds,
    readAccountOutlookContextCache,
    writeAccountOutlookContextCache
} from "@/modules/xchat/account-outlook-context-cache";

export type AccountOutlookRefreshSource = "xai-sentiment" | "yahoo-macro" | "manual";

export type AccountOutlookContextForXchat = {
  marketOutlook: AccountOutlook | null;
  marketOutlookLabel: string;
  riskLevel: "conservative" | "balanced" | "growth" | null;
  riskLevelLabel: string;
  outlookConfidence: number | null;
  lastOutlookRefreshAt: Date | null;
  outlookRefreshSource: AccountOutlookRefreshSource | null;
  outlookNotes: string | null;
  /** Account-level opt-in for scheduled / auto outlook refresh. */
  accountOutlookRefreshEnabled: boolean;
  guardrailMaxPositionPct: number;
  /** Stable for remote-chain fingerprint when outlook/risk/refresh changes. */
  stableFingerprint: string;
  promptInjection: string;
};

function deskRiskLabel(r: AccountOutlookContextForXchat["riskLevel"]): string {
  if (r === "conservative") {
    return "Conservative";
  }
  if (r === "growth") {
    return "Aggressive";
  }
  if (r === "balanced") {
    return "Balanced";
  }
  return "Balanced";
}

/** Default max % equity per name when HNWI guardrail unset — aligns with desk copy in UI. */
export function defaultGuardrailMaxPositionPctForRisk(
  risk: AccountOutlookContextForXchat["riskLevel"]
): number {
  if (risk === "conservative") {
    return 8;
  }
  if (risk === "growth") {
    return 20;
  }
  return 12;
}

function accountToContext(account: Account): AccountOutlookContextForXchat {
  const outlook = account.outlook ?? null;
  const risk = account.riskProfile ?? "balanced";
  const guardFromHnwi = account.hnwiGuardrails?.maxPositionPctOfEquity;
  const guardPct =
    typeof guardFromHnwi === "number" &&
    Number.isFinite(guardFromHnwi) &&
    guardFromHnwi > 0 &&
    guardFromHnwi <= 1
      ? Math.round(guardFromHnwi * 10_000) / 100
      : defaultGuardrailMaxPositionPctForRisk(risk);
  const confidence =
    typeof account.outlookConfidence === "number" &&
    Number.isFinite(account.outlookConfidence) &&
    account.outlookConfidence >= 0 &&
    account.outlookConfidence <= 1
      ? Math.round(account.outlookConfidence * 100) / 100
      : null;
  const lastAt =
    account.lastOutlookRefreshAt instanceof Date
      ? account.lastOutlookRefreshAt
      : typeof account.lastOutlookRefreshAt === "string"
        ? new Date(account.lastOutlookRefreshAt)
        : null;
  const src = account.outlookRefreshSource ?? null;
  const notes =
    typeof account.outlookNotes === "string" && account.outlookNotes.trim().length > 0
      ? account.outlookNotes.trim().slice(0, 2000)
      : null;

  const autoRefresh =
    account.outlookRefreshEnabled === undefined ? true : Boolean(account.outlookRefreshEnabled);

  const fpRaw = [
    outlook ?? "",
    risk,
    String(confidence ?? ""),
    lastAt?.toISOString() ?? "",
    src ?? "",
    String(guardPct),
    autoRefresh ? "1" : "0"
  ].join("|");
  const stableFingerprint = createHash("sha256").update(fpRaw).digest("hex").slice(0, 16);

  const marketOutlookLabel = accountOutlookDisplayLabel(outlook);
  const riskLevelLabel = deskRiskLabel(risk);

  const biasHint =
    outlook === "bearish"
      ? "Favor defensive income, hedges, and reduced directional risk unless user overrides."
      : outlook === "bullish"
        ? "Directional and call-overlay ideas may be appropriate when liquidity and guardrails allow."
        : "Neutral posture: prioritize defined-risk income (spreads, condors, covered calls on liquid names) over naked directional bets.";

  const promptInjection = [
    "Account desk context (canonical for this workspace book):",
    `- Market outlook: **${marketOutlookLabel}**`,
    `- Risk tolerance: **${riskLevelLabel}** (maps growth desk stance to aggressive sizing band in copy)`,
    `- Max position size guideline: **~${guardPct}%** of equity per name unless user-supplied HNWI guardrails say otherwise`,
    `- Strategy bias: ${biasHint}`,
    confidence !== null ? `- Last model confidence (outlook refresh): **${Math.round(confidence * 100)}%**` : null,
    notes ? `- Desk note: ${notes}` : null
  ]
    .filter((line): line is string => Boolean(line && line.trim().length > 0))
    .join("\n");

  return {
    marketOutlook: outlook,
    marketOutlookLabel,
    riskLevel: risk,
    riskLevelLabel,
    outlookConfidence: confidence,
    lastOutlookRefreshAt: lastAt && !Number.isNaN(lastAt.getTime()) ? lastAt : null,
    outlookRefreshSource: src,
    outlookNotes: notes,
    accountOutlookRefreshEnabled: autoRefresh,
    guardrailMaxPositionPct: guardPct,
    stableFingerprint,
    promptInjection
  };
}

/**
 * Loads the **default** custodian account for the workspace portfolio and builds xChat prompt injection.
 */
export async function resolveAccountOutlookContextForXchat(input: {
  userId: string;
  tenantId?: string;
  portfolioIdHex: string;
  skipCache?: boolean;
}): Promise<AccountOutlookContextForXchat | null> {
  const portfolioIdHex = input.portfolioIdHex.trim();
  if (!portfolioIdHex) {
    return null;
  }

  const cacheKey = buildAccountOutlookContextCacheKey({
    userId: input.userId,
    portfolioIdHex,
    tenantId: input.tenantId
  });
  if (!input.skipCache) {
    const cached = await readAccountOutlookContextCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const accounts = await listPortfolioAccounts({
    userId: input.userId,
    portfolioId: portfolioIdHex,
    tenantId: input.tenantId
  });
  const pick =
    accounts.find((a) => a.isDefault && a._id) ?? accounts.find((a) => a._id) ?? accounts[0];
  if (!pick?._id) {
    return null;
  }
  const ctx = accountToContext(pick);
  void writeAccountOutlookContextCache(cacheKey, ctx, getAccountOutlookContextCacheTtlSeconds()).catch(
    () => {
      /* ignore */
    }
  );
  return ctx;
}

export function formatAccountOutlookPromptInjection(
  ctx: AccountOutlookContextForXchat,
  investmentOutlookRefreshFeatureEnabled: boolean
): string {
  const parts = [ctx.promptInjection];
  if (investmentOutlookRefreshFeatureEnabled) {
    const ts =
      ctx.lastOutlookRefreshAt && !Number.isNaN(ctx.lastOutlookRefreshAt.getTime())
        ? ctx.lastOutlookRefreshAt.toISOString()
        : null;
    const src = ctx.outlookRefreshSource ?? "manual";
    parts.push(
      [
        "Outlook refresh surface:",
        ctx.accountOutlookRefreshEnabled
          ? "- Auto-refresh may update Bullish/Neutral/Bearish using tenant-configured pipelines (xAI / macro)."
          : "- Auto-refresh is off for this account; user/manual edits are authoritative.",
        ts
          ? `- Last refreshed (UTC): ${ts} — source **${src}**`
          : "- Last refreshed: not recorded yet (run Refresh Outlook when enabled)."
      ].join("\n")
    );
  }
  return parts.filter(Boolean).join("\n\n");
}
