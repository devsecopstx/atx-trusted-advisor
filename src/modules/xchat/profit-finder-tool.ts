import { formatBackendSessionCookieHeader } from "@/lib/backend-session-cookie";
import { getAtxfinanceBackendOrigin } from "@/lib/env";

const PORTFOLIO_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

export type ProfitFinderMode = "conservative" | "balanced" | "aggressive";
export type ProfitFinderFocus = "income" | "protection" | "both";

const MODES = new Set<ProfitFinderMode>(["conservative", "balanced", "aggressive"]);
const FOCUSES = new Set<ProfitFinderFocus>(["income", "protection", "both"]);

export type ProfitFinderToolRequest = {
  portfolioId?: string;
  mode: ProfitFinderMode;
  focus: ProfitFinderFocus;
  symbols?: string[];
  dteMin?: number;
  dteMax?: number;
  maxResults?: number;
  includeWatchlist?: boolean;
  allowSyntheticFallback?: boolean;
};

export type ProfitFinderToolContext = {
  sessionCookie?: string;
  workspacePortfolioId?: string | null;
};

type ProfitFinderParseResult =
  | { ok: true; payload: ProfitFinderToolRequest }
  | {
      ok: false;
      error: "invalid_profit_finder_context";
      message: string;
      details?: unknown;
    };

export type ProfitFinderToolResult =
  | { ok: true; payload: unknown }
  | {
      ok: false;
      error: "invalid_profit_finder_context" | "portfolio_not_found" | "chain_unavailable" | "engine_unavailable";
      message: string;
      details?: unknown;
    };

export function parseProfitFinderToolArgs(
  args: Record<string, unknown>,
  ctx: Pick<ProfitFinderToolContext, "workspacePortfolioId"> = {}
): ProfitFinderParseResult {
  const portfolioId = normalizePortfolioId(args.portfolioId) ?? normalizePortfolioId(ctx.workspacePortfolioId);
  const mode = normalizeEnum(args.mode ?? args.bias, MODES) ?? "conservative";
  const focus = normalizeEnum(args.focus ?? args.goal, FOCUSES) ?? "both";
  const symbols = normalizeSymbols(args.symbols ?? args.symbol);
  const dteMin = normalizeInteger(args.dteMin);
  const dteMax = normalizeInteger(args.dteMax);
  const maxResults = normalizeInteger(args.maxResults) ?? 12;
  const includeWatchlist = args.includeWatchlist !== false;

  if (maxResults < 1 || maxResults > 24) {
    return {
      ok: false,
      error: "invalid_profit_finder_context",
      message: "maxResults must be between 1 and 24."
    };
  }

  return {
    ok: true,
    payload: {
      portfolioId,
      mode,
      focus,
      symbols: symbols.length > 0 ? symbols : undefined,
      dteMin: dteMin ?? undefined,
      dteMax: dteMax ?? undefined,
      maxResults,
      includeWatchlist,
      allowSyntheticFallback: args.allowSyntheticFallback === true
    } satisfies ProfitFinderToolRequest
  };
}

export async function runProfitFinderTool(
  args: Record<string, unknown>,
  ctx: ProfitFinderToolContext
): Promise<unknown> {
  const parsed = parseProfitFinderToolArgs(args, ctx);
  if (!parsed.ok) {
    return {
      error: parsed.error,
      message: parsed.message,
      details: parsed.details
    };
  }
  const request = parsed.payload;

  const runResult = await runProfitFinderScan(request, ctx);
  if (!runResult.ok) {
    return {
      error: runResult.error,
      message: runResult.message,
      details: runResult.details
    };
  }
  return runResult.payload;
}

async function runProfitFinderScan(
  request: ProfitFinderToolRequest,
  ctx: ProfitFinderToolContext
): Promise<ProfitFinderToolResult> {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return {
      ok: false,
      error: "engine_unavailable",
      message: "Profit Finder requires ATXFINANCE_BACKEND_ORIGIN (Spring strategy service)."
    };
  }

  const cookie = formatBackendSessionCookieHeader(ctx.sessionCookie ?? "");
  if (!cookie) {
    return {
      ok: false,
      error: "engine_unavailable",
      message: "Profit Finder requires an authenticated session."
    };
  }

  let response: Response;
  try {
    response = await fetch(`${origin}/api/profit-finder/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie
      },
      body: JSON.stringify(request)
    });
  } catch (err) {
    return {
      ok: false,
      error: "engine_unavailable",
      message: err instanceof Error ? err.message : "Profit Finder backend request failed."
    };
  }

  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    return { ok: true, payload };
  }

  const error = typeof payload.error === "string" ? payload.error : "engine_unavailable";
  const message =
    typeof payload.message === "string"
      ? payload.message
      : `Profit Finder scan failed (${response.status}).`;

  return {
    ok: false,
    error:
      error === "invalid_profit_finder_context" ||
      error === "portfolio_not_found" ||
      error === "chain_unavailable"
        ? error
        : "engine_unavailable",
    message,
    details: payload
  };
}

function normalizePortfolioId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return PORTFOLIO_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function normalizeSymbols(value: unknown): string[] {
  if (typeof value === "string") {
    const one = value.trim().toUpperCase();
    return SYMBOL_PATTERN.test(one) ? [one] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim().toUpperCase() : ""))
    .filter((s) => SYMBOL_PATTERN.test(s))
    .slice(0, 16);
}

function normalizeEnum<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  if (typeof value !== "string") return undefined;
  const n = value.trim().toLowerCase() as T;
  return allowed.has(n) ? n : undefined;
}

function normalizeInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}