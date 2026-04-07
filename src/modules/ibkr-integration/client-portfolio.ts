import { z } from "zod";

const accountRowSchema = z
  .object({
    id: z.string().optional(),
    accountId: z.string().optional(),
    accountTitle: z.string().optional(),
    displayName: z.string().optional(),
    currency: z.string().optional(),
    type: z.string().optional()
  })
  .passthrough();

export type IbkrPortfolioAccountSummary = {
  id: string;
  displayLabel: string;
  currency?: string;
};

export function buildIbkrPortfolioAccountsUrl(baseUrl: string): string {
  const u = baseUrl.replace(/\/+$/, "");
  return `${u}/v1/api/portfolio/accounts`;
}

export function parseIbkrPortfolioAccountsJson(
  data: unknown
): { ok: true; accounts: IbkrPortfolioAccountSummary[] } | { ok: false; error: string } {
  const arr = z.array(z.unknown()).safeParse(data);
  if (!arr.success) {
    return { ok: false, error: "expected_json_array" };
  }
  const accounts: IbkrPortfolioAccountSummary[] = [];
  for (const row of arr.data) {
    const p = accountRowSchema.safeParse(row);
    if (!p.success) {
      continue;
    }
    const id = (p.data.id ?? p.data.accountId ?? "").trim();
    if (!id) {
      continue;
    }
    const displayLabel = (p.data.displayName ?? p.data.accountTitle ?? id).trim() || id;
    accounts.push({
      id,
      displayLabel,
      currency: p.data.currency?.trim() || undefined
    });
  }
  return { ok: true, accounts };
}

export type FetchIbkrPortfolioAccountsResult =
  | { ok: true; accounts: IbkrPortfolioAccountSummary[]; httpStatus: number }
  | { ok: false; error: string; httpStatus?: number };

/**
 * Server-side fetch to Client Portal gateway. Caller supplies the full `Cookie` header value.
 * Does not log cookies or raw bodies.
 */
export async function fetchIbkrPortfolioAccounts(options: {
  baseUrl: string;
  cookieHeader: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}): Promise<FetchIbkrPortfolioAccountsResult> {
  const cookieHeader = options.cookieHeader.trim();
  if (!cookieHeader) {
    return { ok: false, error: "missing_cookie" };
  }
  const url = buildIbkrPortfolioAccountsUrl(options.baseUrl);
  const fetchFn = options.fetchFn ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
        "User-Agent": "xfinance-ibkr-integration/phase2"
      },
      signal: options.signal
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
  const httpStatus = res.status;
  if (!res.ok) {
    return { ok: false, error: "upstream_http_error", httpStatus };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "invalid_json", httpStatus };
  }
  const parsed = parseIbkrPortfolioAccountsJson(json);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, httpStatus };
  }
  return { ok: true, accounts: parsed.accounts, httpStatus };
}
