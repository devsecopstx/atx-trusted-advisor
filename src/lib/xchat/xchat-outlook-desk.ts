import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import type { AccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";

/** Portfolio / account labels for the welcome-row outlook badge. */
export type XchatOutlookBookScope = {
  portfolioName: string | null;
  accountName: string | null;
};

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

export function resolveXchatOutlookBookScope(
  workspaceBook: AppUserDefaultBook | null | undefined,
  portfolioId: string,
  accountId: string | null
): XchatOutlookBookScope | null {
  const pid = portfolioId.trim();
  if (!pid || !workspaceBook) {
    return null;
  }
  const portfolioName =
    workspaceBook.workspacePortfolios.find((p) => p.id === pid)?.name?.trim() ??
    (workspaceBook.portfolioId === pid ? workspaceBook.portfolioName?.trim() : null) ??
    null;
  let accountName: string | null = null;
  if (workspaceBook.portfolioId === pid) {
    const aid = accountId?.trim() || workspaceBook.accountId?.trim() || "";
    if (aid) {
      accountName =
        workspaceBook.accounts.find((a) => a.id === aid)?.name?.trim() ??
        workspaceBook.accountName?.trim() ??
        null;
    } else {
      accountName = workspaceBook.accountName?.trim() ?? null;
    }
  }
  if (!portfolioName && !accountName) {
    return null;
  }
  return { portfolioName, accountName };
}

export function formatOutlookBookScopeLabel(scope: XchatOutlookBookScope | null | undefined): string | null {
  const portfolio = scope?.portfolioName?.trim();
  const account = scope?.accountName?.trim();
  if (portfolio && account) {
    return `${portfolio} · ${account}`;
  }
  if (portfolio) {
    return portfolio;
  }
  if (account) {
    return account;
  }
  return null;
}

export function formatOutlookFreshnessLabel(
  input: {
    marketOutlookLabel: string | null;
    lastOutlookRefreshAt: string | null;
    bookScope?: XchatOutlookBookScope | null;
  },
  nowMs: number = Date.now()
): string | null {
  const age = formatOutlookAgeLabel(input.lastOutlookRefreshAt, nowMs);
  const outlook = input.marketOutlookLabel?.trim();
  const scopeLabel = formatOutlookBookScopeLabel(input.bookScope);
  let outlookPart: string | null = null;
  if (age && outlook) {
    outlookPart = `Outlook ${outlook} · refreshed ${age}`;
  } else if (age) {
    outlookPart = `Outlook refreshed ${age}`;
  } else if (outlook) {
    outlookPart = `Outlook ${outlook}`;
  }
  if (scopeLabel && outlookPart) {
    return `${scopeLabel} — ${outlookPart}`;
  }
  return scopeLabel ?? outlookPart;
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
