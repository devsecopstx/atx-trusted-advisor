/**
 * Low-level Client Portal Web API JSON fetch (HTTPS gateway base URL + `/v1/api` prefix).
 * Callers must not log cookie headers or raw bodies.
 */

export function buildIbkrCpApiUrl(baseUrl: string, apiPath: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${base}/v1/api${path}`;
}

export type IbkrCpJsonResult =
  | { ok: true; data: unknown; httpStatus: number }
  | { ok: false; error: string; httpStatus?: number };

export async function ibkrCpFetchJson(options: {
  baseUrl: string;
  cookieHeader: string;
  apiPath: string;
  method?: "GET" | "POST";
  body?: unknown;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  userAgentSuffix?: string;
}): Promise<IbkrCpJsonResult> {
  const cookieHeader = options.cookieHeader.trim();
  if (!cookieHeader) {
    return { ok: false, error: "missing_cookie" };
  }
  const url = buildIbkrCpApiUrl(options.baseUrl, options.apiPath);
  const method = options.method ?? "GET";
  const fetchFn = options.fetchFn ?? fetch;
  const ua = `xfinance-ibkr-integration/${options.userAgentSuffix ?? "phase3"}`;
  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    Accept: "application/json",
    "User-Agent": ua
  };
  let res: Response;
  try {
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      res = await fetchFn(url, {
        method: "POST",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : "{}",
        signal: options.signal
      });
    } else {
      res = await fetchFn(url, {
        method: "GET",
        headers,
        signal: options.signal
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
  const httpStatus = res.status;
  if (httpStatus === 401 || httpStatus === 403) {
    return { ok: false, error: "upstream_auth", httpStatus };
  }
  if (!res.ok) {
    return { ok: false, error: "upstream_http_error", httpStatus };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "invalid_json", httpStatus };
  }
  return { ok: true, data, httpStatus };
}
