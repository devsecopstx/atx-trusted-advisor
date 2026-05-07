import {
    proxyPortfolioRequestToBackend,
    releaseUnusedProxyResponse
} from "@/lib/backend-bff";
import {
    isXchatSseProxyBackendEnabled,
    resolveXchatStreamInternalSecretHeader
} from "@/lib/xchat-live-sse-policy";

/**
 * Live SSE for xChat: proxies to Spring when `XCHAT_SSE_PROXY_BACKEND` + BFF are on; otherwise
 * delegates to `POST /api/xchat/ask` with `Accept: text/event-stream` (true token stream + same `done` shape).
 *
 * Events: `meta`, `delta`, `turn`, `provider`, `tool_status`, `ping`, `done` (stripped bodies), `error`.
 */
export async function POST(request: Request) {
  if (isXchatSseProxyBackendEnabled()) {
    const proxied = await proxyPortfolioRequestToBackend(request.clone());
    if (proxied) {
      if (proxied.status === 404) {
        releaseUnusedProxyResponse(proxied);
      } else {
        return proxied;
      }
    }
  }

  const bodyText = await request.text();
  const url = new URL(request.url);
  const askUrl = `${url.origin}/api/xchat/ask`;

  let askRes: Response;
  try {
    askRes = await fetch(askUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        accept: "text/event-stream",
        cookie: request.headers.get("cookie") ?? "",
        ...resolveXchatStreamInternalSecretHeader(),
        ...(request.headers.get("x-forwarded-for")
          ? { "x-forwarded-for": request.headers.get("x-forwarded-for")! }
          : {}),
        ...(request.headers.get("authorization")
          ? { authorization: request.headers.get("authorization")! }
          : {})
      },
      body: bodyText,
      signal: request.signal,
      cache: "no-store"
    });
  } catch (e) {
    return Response.json(
      {
        error: "xchat_stream_ask_delegate_failed",
        details: e instanceof Error ? e.message : String(e)
      },
      { status: 502 }
    );
  }

  const limiterHeaders = pickXchatLimiterHeaders(askRes.headers);
  const ct = askRes.headers.get("content-type") ?? "";

  if (ct.includes("text/event-stream") && askRes.body) {
    const headers = new Headers(limiterHeaders);
    headers.set("content-type", "text/event-stream; charset=utf-8");
    headers.set("cache-control", "no-cache, no-transform");
    headers.set("connection", "keep-alive");
    headers.set("x-accel-buffering", "no");
    return new Response(askRes.body, { status: askRes.status, headers });
  }

  const fallbackText = await askRes.text();
  return new Response(fallbackText, {
    status: askRes.status,
    headers: {
      ...Object.fromEntries(limiterHeaders.entries()),
      "content-type": askRes.headers.get("content-type") ?? "application/json; charset=utf-8"
    }
  });
}

function pickXchatLimiterHeaders(src: Headers): Headers {
  const out = new Headers();
  const names = [
    "x-xchat-limit-remaining-minute",
    "x-xchat-limit-remaining-hour",
    "x-xchat-limit-remaining-day",
    "x-xchat-limit-hourly",
    "x-xchat-limit-daily",
    "retry-after"
  ] as const;
  for (const n of names) {
    const v = src.get(n);
    if (v) {
      out.set(n, v);
    }
  }
  return out;
}
