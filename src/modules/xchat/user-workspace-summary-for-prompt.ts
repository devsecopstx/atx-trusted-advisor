import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import type { Portfolio, Position } from "@/modules/core-admin/types";
import { formatPositionUsd, normalizePositionType } from "@/modules/core-admin/types";
import { countActivePortfolioPriceAlertsForUser } from "@/modules/price-alerts/portfolio-price-alerts-repository";

export type UserWorkspaceSummaryPortfolioRow = {
  name: string;
  id: string;
  holdings: string;
  cash: string;
  riskLevel: string | null;
};

export type UserWorkspaceNlPriceAlertsSummary = {
  activeNlAlertCount: number;
  alertsDeepLink: string;
};

export type UserWorkspaceSummaryJson = {
  workspace: {
    activePortfolio: string;
    activePortfolioId: string;
    /** Count of active `portfolio_price_alerts` NL rules for this user + link to the desk (mutations: `price_alert_manage`). */
    nlPriceAlerts?: UserWorkspaceNlPriceAlertsSummary;
    portfolios: UserWorkspaceSummaryPortfolioRow[];
  };
};

const MAX_PORTFOLIOS = 12;
const MAX_POSITION_LINES = 48;
const MAX_HOLDINGS_CHARS = 520;

export type UserWorkspaceSummaryContext = {
  userId: string;
  tenantId?: string;
  workspacePortfolioId?: string | null;
};

function mapRiskLevelFromAccounts(
  accounts: Array<{ isDefault: boolean; riskProfile?: "conservative" | "balanced" | "growth" | null }>
): string | null {
  const ordered = [...accounts].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const r = ordered.find((a) => a.riskProfile != null)?.riskProfile;
  if (r === "conservative") {
    return "conservative";
  }
  if (r === "balanced") {
    return "moderate";
  }
  if (r === "growth") {
    return "aggressive";
  }
  return null;
}

function formatOptionExpiryUtc(exp: Date | string | null | undefined): string {
  if (!exp) {
    return "?";
  }
  const d = exp instanceof Date ? exp : new Date(exp);
  if (!Number.isFinite(d.getTime())) {
    return "?";
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export function formatHoldingsSummaryFromPositions(positions: Position[]): string {
  if (positions.length === 0) {
    return "No positions recorded";
  }
  const sorted = [...positions].sort(
    (a, b) => Math.abs(b.qty * b.avgCost) - Math.abs(a.qty * a.avgCost)
  );
  const lines: string[] = [];
  let used = 0;
  for (const pos of sorted) {
    if (lines.length >= MAX_POSITION_LINES) {
      break;
    }
    const type = normalizePositionType(pos.type);
    const qty = pos.qty;
    const absQty = Math.abs(qty);
    const side = qty < 0 ? "short" : "long";
    let piece: string;
    if (type === "option" && pos.optionType && pos.strike != null && pos.expiration) {
      const expStr = formatOptionExpiryUtc(pos.expiration);
      const strike = Number(pos.strike);
      const sk = Number.isFinite(strike) ? strike.toFixed(0) : String(pos.strike);
      piece = `${side} ${absQty}× ${expStr} $${sk} ${pos.optionType}`;
    } else if (type === "cash") {
      piece = `${pos.symbol} cash`;
    } else {
      const px = formatPositionUsd(pos.avgCost);
      piece = `${qty} ${pos.symbol.trim().toUpperCase()} @ ${px}`;
    }
    if (used + piece.length + 2 > MAX_HOLDINGS_CHARS && lines.length > 0) {
      break;
    }
    lines.push(piece);
    used += piece.length + 2;
  }
  const omitted = positions.length - lines.length;
  const base = lines.join("; ");
  if (omitted > 0) {
    return `${base}; +${omitted} more position row(s) — use atx_function positions_snapshot for full book`;
  }
  return base;
}

function formatCashAcrossAccounts(
  accounts: Array<{ name: string; cashBalance: number; isDefault: boolean }>
): string {
  if (accounts.length === 0) {
    return "$0.00 (no accounts)";
  }
  const total = accounts.reduce((s, a) => s + (a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE), 0);
  const head = `${formatPositionUsd(total)} total`;
  const parts = accounts
    .slice(0, 5)
    .map((a) => `${a.name}: ${formatPositionUsd(a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE)}`);
  const tail = accounts.length > 5 ? `; +${accounts.length - 5} more account(s)` : "";
  return `${head} (${parts.join("; ")}${tail})`;
}

async function resolveActivePortfolio(input: UserWorkspaceSummaryContext): Promise<Portfolio | null> {
  const hint = input.workspacePortfolioId?.trim();
  if (hint && /^[a-f\d]{24}$/i.test(hint)) {
    const selected = await getPortfolioByIdForSessionUser({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioId: hint.toLowerCase()
    });
    if (selected?._id) {
      return selected;
    }
  }
  return getDefaultPortfolio(input.userId, { tenantId: input.tenantId });
}

/**
 * Lightweight multi-portfolio book summary for xChat NL (server preflight + optional atx_function.user_workspace_summary).
 */
export async function loadUserWorkspaceSummaryForPrompt(
  ctx: UserWorkspaceSummaryContext
): Promise<UserWorkspaceSummaryJson | null> {
  const rows = await listPortfoliosForSessionUser({
    userId: ctx.userId,
    tenantId: ctx.tenantId
  });
  if (rows.length === 0) {
    return null;
  }
  const active = await resolveActivePortfolio(ctx);
  const activeId = active?._id?.toHexString() ?? "";
  const activeName = active?.name?.trim() || "Workspace portfolio";
  const capped = rows.filter((p) => p._id).slice(0, MAX_PORTFOLIOS);
  const portfolios: UserWorkspaceSummaryPortfolioRow[] = [];

  for (const p of capped) {
    const portfolioId = p._id!.toHexString();
    const accounts = await listPortfolioAccounts({
      userId: ctx.userId,
      portfolioId,
      tenantId: ctx.tenantId
    });
    const accountIds = accounts.map((a) => a._id).filter((id): id is NonNullable<(typeof accounts)[0]["_id"]> => Boolean(id));
    const positions =
      accountIds.length > 0
        ? await listPortfolioPositionsByAccount({
            userId: ctx.userId,
            portfolioId,
            accountIds,
            tenantId: ctx.tenantId
          })
        : [];
    const acctRows = accounts.map((a) => ({
      name: a.name?.trim() || "Account",
      cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
      isDefault: Boolean(a.isDefault),
      riskProfile: a.riskProfile
    }));
    portfolios.push({
      name: p.name?.trim() || "Portfolio",
      id: portfolioId,
      holdings: formatHoldingsSummaryFromPositions(positions),
      cash: formatCashAcrossAccounts(acctRows),
      riskLevel: mapRiskLevelFromAccounts(acctRows)
    });
  }

  const nlPriceAlerts: UserWorkspaceNlPriceAlertsSummary | undefined =
    activeId.length > 0
      ? {
          activeNlAlertCount: await countActivePortfolioPriceAlertsForUser({
            userId: ctx.userId,
            tenantId: ctx.tenantId
          }),
          alertsDeepLink: `/portfolio/alerts?portfolioId=${encodeURIComponent(activeId)}`
        }
      : undefined;

  return {
    workspace: {
      activePortfolio: activeName,
      activePortfolioId: activeId,
      ...(nlPriceAlerts ? { nlPriceAlerts } : {}),
      portfolios
    }
  };
}

export const XCHAT_USER_WORKSPACE_SUMMARY_INSTRUCTION = `You are always given the user's current workspace context in the JSON block below (server preflight).
When the user refers to portfolio names, nicknames, or account labels that match this summary (for example "Rollover IRA", "ROTH IRA", "my growth book"), you must anchor answers to the exact named portfolio id from that JSON.
If \`nlPriceAlerts\` is present, use \`activeNlAlertCount\` and \`alertsDeepLink\` for NL price-rule context; use \`price_alert_manage\` to list/add/remove rules (Premium+ advisor path).
Never give generic multi-account answers unless the user explicitly asks for an overview of all accounts or compares books.`;

export function formatUserWorkspaceSummaryBlock(summary: UserWorkspaceSummaryJson): string {
  const json = JSON.stringify(summary);
  return [
    "User workspace summary (getUserWorkspaceSummary / server preflight — authoritative friendly names for this request):",
    XCHAT_USER_WORKSPACE_SUMMARY_INSTRUCTION,
    "```json",
    json,
    "```"
  ].join("\n");
}
