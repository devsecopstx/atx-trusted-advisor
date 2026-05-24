import { ObjectId } from "mongodb";
import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/auth";
import { getAtxfinanceBackendOrigin } from "@/lib/env";
import { getDb } from "@/lib/mongodb";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";
import {
    ensureUserWatchlistForSessionUser,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import { getCoreUserById } from "@/modules/identity/repository";

import type { HotPicksPayload, HotPicksQueryInput } from "./hot-picks-types";

const PORTFOLIO_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const DEFAULT_MARKET_SYMBOLS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMD",
  "META",
  "AMZN",
  "GOOGL",
  "RKLB",
  "RDW"
];

export function parseHotPicksQueryFromUrl(url: URL): HotPicksQueryInput | { error: string } {
  const scopeRaw = url.searchParams.get("scope")?.trim().toLowerCase() ?? "portfolio";
  const biasRaw = url.searchParams.get("bias")?.trim().toLowerCase() ?? "balanced";
  const portfolioId = url.searchParams.get("portfolioId")?.trim() || null;
  const minEdgeScore = clampInt(url.searchParams.get("minEdgeScore"), 60, 0, 100);
  const maxEdgeScore = clampInt(url.searchParams.get("maxEdgeScore"), 90, minEdgeScore, 100);
  const dteMin = clampInt(url.searchParams.get("dteMin"), 7, 1, 90);
  const dteMax = clampInt(url.searchParams.get("dteMax"), 21, dteMin, 120);

  const scope =
    scopeRaw === "portfolio" || scopeRaw === "book"
      ? "portfolio"
      : scopeRaw === "watchlist"
        ? "watchlist"
        : scopeRaw === "market" || scopeRaw === "all_market" || scopeRaw === "all"
          ? "market"
          : null;
  const bias =
    biasRaw === "conservative"
      ? "conservative"
      : biasRaw === "balanced" || biasRaw === "moderate"
        ? "balanced"
        : biasRaw === "aggressive"
          ? "aggressive"
          : null;

  if (!scope) {
    return { error: "invalid_scope" };
  }
  if (!bias) {
    return { error: "invalid_bias" };
  }
  if (scope === "portfolio" && (!portfolioId || !PORTFOLIO_ID_PATTERN.test(portfolioId))) {
    return { error: "invalid_portfolio" };
  }

  return {
    scope,
    bias,
    portfolioId,
    minEdgeScore,
    maxEdgeScore,
    dteMin,
    dteMax
  };
}

export async function fetchHotPicksDirectFromBackend(
  query: HotPicksQueryInput,
  sessionCookie: string
): Promise<HotPicksPayload | null> {
  const origin = getAtxfinanceBackendOrigin()?.replace(/\/$/, "");
  if (!origin) {
    return null;
  }
  const qs = new URLSearchParams({
    scope: query.scope,
    bias: query.bias,
    minEdgeScore: String(query.minEdgeScore),
    maxEdgeScore: String(query.maxEdgeScore),
    dteMin: String(query.dteMin),
    dteMax: String(query.dteMax)
  });
  if (query.portfolioId) {
    qs.set("portfolioId", query.portfolioId);
  }
  let response: Response;
  try {
    response = await fetch(`${origin}/api/portfolios/hot-picks?${qs.toString()}`, {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}` },
      cache: "no-store"
    });
  } catch {
    return null;
  }
  const body = (await response.json().catch(() => ({}))) as {
    data?: HotPicksPayload;
    error?: string;
  };
  if (!response.ok || !body.data) {
    return null;
  }
  return body.data;
}

/** Next-local fallback when JVM BFF proxy is off but origin is set, or for symbol preflight. */
export async function runHotPicksScanNextFallback(
  session: SessionUser,
  query: HotPicksQueryInput
): Promise<HotPicksPayload> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    const fromBackend = await fetchHotPicksDirectFromBackend(query, sessionCookie);
    if (fromBackend) {
      return fromBackend;
    }
  }

  const symbols = await resolveHotPicksSymbols(session, query);
  const cachedAt = new Date().toISOString();
  return {
    picks: [],
    meta: {
      scope: query.scope,
      bias: query.bias,
      portfolioId: query.portfolioId,
      minEdgeScore: query.minEdgeScore,
      maxEdgeScore: query.maxEdgeScore,
      dteMin: query.dteMin,
      dteMax: query.dteMax,
      symbolCount: symbols.length,
      symbols,
      cachedAt,
      cacheTtlSeconds: 3600,
      cacheHit: false
    }
  };
}

async function resolveHotPicksSymbols(
  session: SessionUser,
  query: HotPicksQueryInput
): Promise<string[]> {
  if (query.scope === "market") {
    return DEFAULT_MARKET_SYMBOLS;
  }
  if (query.scope === "watchlist") {
    const wl = await ensureUserWatchlistForSessionUser({
      userId: session.userId,
      tenantId: session.tenantId
    });
    return (wl?.symbols ?? [])
      .map((s) => (typeof s === "string" ? s : s.symbol)?.trim().toUpperCase())
      .filter((s): s is string => Boolean(s && /^[A-Z0-9.\-]{1,12}$/.test(s)));
  }
  const portfolioId = query.portfolioId;
  if (!portfolioId || !ObjectId.isValid(portfolioId)) {
    return [];
  }
  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  const owned = portfolios.some((p) => p._id?.toHexString() === portfolioId);
  if (!owned) {
    return [];
  }
  const db = await getDb();
  const accounts = await db
    .collection("portfolio_accounts")
    .find({
      portfolioId: new ObjectId(portfolioId),
      tenantId: session.tenantId,
      userId: session.userId
    })
    .project({ _id: 1 })
    .toArray();
  const accountIds = accounts.map((a) => a._id).filter((id): id is ObjectId => id instanceof ObjectId);
  if (accountIds.length === 0) {
    return [];
  }
  const positions = await db
    .collection("portfolio_positions")
    .find({ accountId: { $in: accountIds }, tenantId: session.tenantId })
    .project({ symbol: 1 })
    .toArray();
  const out = new Set<string>();
  for (const row of positions) {
    const sym = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
    if (sym && /^[A-Z0-9.\-]{1,12}$/.test(sym)) {
      out.add(sym);
    }
  }
  return [...out];
}

export async function resolveHotPicksOptionsApproved(session: SessionUser): Promise<boolean> {
  if (!ObjectId.isValid(session.userId)) {
    return false;
  }
  const user = await getCoreUserById(new ObjectId(session.userId));
  const flag = user as { optionsTradingEnabled?: boolean | null } | null;
  return flag?.optionsTradingEnabled === true;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw != null ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}
