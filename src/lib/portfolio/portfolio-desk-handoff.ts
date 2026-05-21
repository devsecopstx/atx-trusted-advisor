import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { buildXoptionsBuilderHref } from "@/lib/xoptions/xoptions-builder-url";
import { toYahooOptionContractId } from "@/lib/xoptions/xoptions-contract-id";
import {
    isValidXoptionsUnderlyingSymbol,
    normalizeXoptionsUnderlyingSymbol
} from "@/lib/xoptions/xoptions-desk-deep-link";
import { underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";

export type PortfolioDeskHandoffContext = {
  portfolioIdHex: string;
  accountIdHex: string;
  accountName: string;
  portfolioName?: string | null;
  positions?: SerializablePosition[];
  focusSymbol?: string | null;
};

function stockBookUsd(p: SerializablePosition & { type: "stock" }): number {
  return Math.max(0, p.shares) * Math.max(0, p.purchasePrice);
}

/** Largest stock book, else first option underlying, else explicit focus symbol. */
export function resolvePortfolioDeskFocusSymbol(
  positions: SerializablePosition[],
  focusSymbol?: string | null
): string | null {
  const explicit = normalizeXoptionsUnderlyingSymbol(focusSymbol ?? "");
  if (explicit && isValidXoptionsUnderlyingSymbol(explicit)) {
    return explicit;
  }

  let best: { symbol: string; book: number } | null = null;
  for (const p of positions) {
    if (p.type !== "stock") {
      continue;
    }
    const symbol = normalizeXoptionsUnderlyingSymbol(p.symbol);
    if (!isValidXoptionsUnderlyingSymbol(symbol)) {
      continue;
    }
    const book = stockBookUsd(p);
    if (!best || book > best.book) {
      best = { symbol, book };
    }
  }
  if (best) {
    return best.symbol;
  }

  for (const p of positions) {
    if (p.type !== "option") {
      continue;
    }
    const symbol = normalizeXoptionsUnderlyingSymbol(underlyingForYahooOptionsChain(p.symbol));
    if (isValidXoptionsUnderlyingSymbol(symbol)) {
      return symbol;
    }
  }

  return null;
}

export function buildPortfoliosWorkspaceXchatPrompt(portfolioName?: string | null): string {
  const book = portfolioName?.trim();
  return book
    ? `Review my ${book} portfolio: allocation, cash vs positions, and one defined-risk options income idea.`
    : "Review my portfolios: allocation, cash vs positions, and one defined-risk options income idea.";
}

export function buildPortfolioDeskXchatPrompt(input: {
  accountName: string;
  portfolioName?: string | null;
  symbol?: string | null;
}): string {
  const account = input.accountName.trim() || "this account";
  const book = input.portfolioName?.trim();
  const symbol = input.symbol?.trim().toUpperCase();
  if (symbol) {
    return book
      ? `Review my ${account} holdings in ${book}, starting with ${symbol}. Summarize position size, cost basis vs last, and one defined-risk options income idea.`
      : `Review my ${account} holdings, starting with ${symbol}. Summarize position size, cost basis vs last, and one defined-risk options income idea.`;
  }
  return book
    ? `Review my ${account} holdings in ${book}. Summarize allocation, cash vs positions, and one defined-risk options income idea.`
    : `Review my ${account} holdings. Summarize allocation, cash vs positions, and one defined-risk options income idea.`;
}

export type PortfolioOptionsChainBuilderHandoff = {
  portfolioIdHex: string;
  accountIdHex: string;
  symbol: string;
  expiration: string;
  side: "call" | "put";
  strike: number;
};

/** Deep link into xOptions step 4 (choose contract) with desk scope + OCC contract id. */
export function buildPortfolioOptionsChainBuilderHref(input: PortfolioOptionsChainBuilderHandoff): string {
  const symbol = normalizeXoptionsUnderlyingSymbol(input.symbol);
  if (!isValidXoptionsUnderlyingSymbol(symbol)) {
    return "/xoptions";
  }
  const contractId = toYahooOptionContractId({
    underlying: symbol,
    expirationYyyyMmDd: input.expiration.slice(0, 10),
    side: input.side,
    strike: input.strike
  });
  const base = buildXoptionsBuilderHref("/xoptions", {
    step: 4,
    symbol,
    contractId
  });
  const scope = new URLSearchParams({
    portfolioId: input.portfolioIdHex,
    accountId: input.accountIdHex
  });
  return `${base}${base.includes("?") ? "&" : "?"}${scope.toString()}`;
}

export function buildPositionDeskHandoffUrls(input: {
  portfolioIdHex: string;
  accountIdHex: string;
  symbol: string;
}): {
  xchatHref: string;
  fullChainHref: string;
  symbol: string;
} {
  const symbol = normalizeXoptionsUnderlyingSymbol(input.symbol);
  const q = new URLSearchParams({
    portfolioId: input.portfolioIdHex,
    accountId: input.accountIdHex,
    symbol
  });
  const scoped = q.toString();
  return {
    symbol,
    fullChainHref: `/xoptions/full-chain?${scoped}`,
    xchatHref: `/xchat?${scoped}&rail=xchat&item=composer`
  };
}

export function buildPortfolioDeskHandoffUrls(input: PortfolioDeskHandoffContext): {
  xchatHref: string;
  xoptionsHref: string;
  symbol: string | null;
} {
  const symbol = resolvePortfolioDeskFocusSymbol(input.positions ?? [], input.focusSymbol);
  const q = new URLSearchParams({
    portfolioId: input.portfolioIdHex,
    accountId: input.accountIdHex
  });
  if (symbol) {
    q.set("symbol", symbol);
  }
  const scoped = q.toString();
  return {
    symbol,
    xoptionsHref: `/xoptions?${scoped}`,
    xchatHref: `/xchat?${scoped}&rail=xchat&item=composer`
  };
}
