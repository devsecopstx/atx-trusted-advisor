import { ibkrCpFetchJson } from "@/modules/ibkr-integration/ibkr-cp-http";

export async function fetchIbkrPortfolioSummary(options: {
  baseUrl: string;
  cookieHeader: string;
  accountId: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}) {
  const id = encodeURIComponent(options.accountId.trim());
  return ibkrCpFetchJson({
    baseUrl: options.baseUrl,
    cookieHeader: options.cookieHeader,
    apiPath: `/portfolio/${id}/summary`,
    fetchFn: options.fetchFn,
    signal: options.signal
  });
}

/** Near-real-time positions (IBKR recommends calling `/portfolio/accounts` first). */
export async function fetchIbkrPortfolio2Positions(options: {
  baseUrl: string;
  cookieHeader: string;
  accountId: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}) {
  const id = encodeURIComponent(options.accountId.trim());
  return ibkrCpFetchJson({
    baseUrl: options.baseUrl,
    cookieHeader: options.cookieHeader,
    apiPath: `/portfolio2/${id}/positions`,
    fetchFn: options.fetchFn,
    signal: options.signal
  });
}

/** Prefer `portfolio2/positions`; fall back to paginated `positions/0` on older gateways. */
export async function fetchIbkrPortfolioPositionsWithFallback(options: {
  baseUrl: string;
  cookieHeader: string;
  accountId: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}) {
  const primary = await fetchIbkrPortfolio2Positions(options);
  if (primary.ok) {
    return { ...primary, source: "portfolio2" as const };
  }
  if (primary.httpStatus === 404) {
    const id = encodeURIComponent(options.accountId.trim());
    const legacy = await ibkrCpFetchJson({
      baseUrl: options.baseUrl,
      cookieHeader: options.cookieHeader,
      apiPath: `/portfolio/${id}/positions/0`,
      fetchFn: options.fetchFn,
      signal: options.signal
    });
    if (legacy.ok) {
      return { ...legacy, source: "positions_paged" as const };
    }
    return legacy;
  }
  return primary;
}

/** Required before live orders / orders list for the target account (CP session state). */
export async function postIbkrSwitchAccount(options: {
  baseUrl: string;
  cookieHeader: string;
  accountId: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; data: unknown; httpStatus: number }
  | { ok: false; error: string; httpStatus?: number; switchDeclined?: boolean }
> {
  const res = await ibkrCpFetchJson({
    baseUrl: options.baseUrl,
    cookieHeader: options.cookieHeader,
    apiPath: "/iserver/account",
    method: "POST",
    body: { acctId: options.accountId.trim() },
    fetchFn: options.fetchFn,
    signal: options.signal
  });
  if (!res.ok) {
    return res;
  }
  const body = res.data;
  if (body && typeof body === "object" && "set" in body && (body as { set?: boolean }).set === false) {
    return {
      ok: false,
      error: "ibkr_switch_account_declined",
      httpStatus: res.httpStatus,
      switchDeclined: true
    };
  }
  return res;
}

export async function fetchIbkrLiveOrders(options: {
  baseUrl: string;
  cookieHeader: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}) {
  return ibkrCpFetchJson({
    baseUrl: options.baseUrl,
    cookieHeader: options.cookieHeader,
    apiPath: "/iserver/account/orders",
    fetchFn: options.fetchFn,
    signal: options.signal
  });
}

/** IBKR "trades" — recent executions (selected account). */
export async function fetchIbkrAccountTrades(options: {
  baseUrl: string;
  cookieHeader: string;
  days: number;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}) {
  const days = Math.min(7, Math.max(1, Math.floor(options.days)));
  return ibkrCpFetchJson({
    baseUrl: options.baseUrl,
    cookieHeader: options.cookieHeader,
    apiPath: `/iserver/account/trades?days=${days}`,
    fetchFn: options.fetchFn,
    signal: options.signal
  });
}
