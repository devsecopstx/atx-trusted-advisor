import { fetchIbkrPortfolioAccounts } from "@/modules/ibkr-integration/client-portfolio";

export async function assertIbkrAccountAllowedForUser(options: {
  baseUrl: string;
  cookieHeader: string;
  accountId: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{ ok: true } | { ok: false; error: string; httpStatus?: number }> {
  const want = options.accountId.trim();
  if (!want || want.length > 48) {
    return { ok: false, error: "invalid_account_id", httpStatus: 400 };
  }
  const list = await fetchIbkrPortfolioAccounts({
    baseUrl: options.baseUrl,
    cookieHeader: options.cookieHeader,
    fetchFn: options.fetchFn,
    signal: options.signal
  });
  if (!list.ok) {
    return { ok: false, error: list.error, httpStatus: list.httpStatus };
  }
  const allowed = list.accounts.some((a) => a.id === want);
  if (!allowed) {
    return { ok: false, error: "ibkr_account_not_in_portfolio", httpStatus: 403 };
  }
  return { ok: true };
}
