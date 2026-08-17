import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const maxDuration = 120;

import { requireSessionUser } from "@/lib/auth";
import {
    proxyPortfolioRequestToBackend,
    releaseUnusedProxyResponse
} from "@/lib/backend-bff";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    isXchatSseProxyBackendEnabled,
    parseXchatStreamRequestMessage,
    resolveXchatStreamInternalSecretHeader,
    shouldSkipXchatStreamBffForDeterministicDeskMessage
} from "@/lib/xchat-live-sse-policy";
import { advisorComplianceGateResponseForAppUser } from "@/modules/compliance/advisor-compliance-gate";

/**
 * Live SSE for xChat.
 *
 * - **BFF:** Proxies to Spring when the product BFF gate is on (`shouldProxyPortfolioRequestsToBackend` — same as
 *   other `bff-proxy-routes.ts` entries). Set **`XCHAT_SSE_PROXY_BACKEND=0|false|no|off`** to force in-process Next
 *   streaming even when the gate is on (opt-out).
 * - **Fallback:** in-process call to `/api/xchat/ask` (no HTTP loopback). If Spring returns **404**, release the body
 *   and fall through here.
 * - Options scan / watchlist / holdings paths may return JSON through this route (client handles non-SSE bodies).
 */
export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenant =
    session.tenantId && ObjectId.isValid(session.tenantId)
      ? await getTenantByHexIdCached(session.tenantId)
      : null;
  const complianceBlocked = await advisorComplianceGateResponseForAppUser(session, tenant);
  if (complianceBlocked) {
    return complianceBlocked;
  }

  const bodyText = await request.text();
  const streamMessage = parseXchatStreamRequestMessage(bodyText);
  const skipBffForDeterministicDesk = shouldSkipXchatStreamBffForDeterministicDeskMessage(streamMessage);

  if (isXchatSseProxyBackendEnabled() && !skipBffForDeterministicDesk) {
    const proxied = await proxyPortfolioRequestToBackend(
      new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bodyText,
        signal: request.signal,
        cache: "no-store"
      })
    );
    if (proxied) {
      if (proxied.status === 404) {
        releaseUnusedProxyResponse(proxied);
      } else {
        return wrapBffProxiedStreamForNextPipe(proxied);
      }
    }
  }

  // In-process delegation (no network hop — fixes prod Cloud Run 502)

  // Dynamically import the ask handler so we call it directly in-process
  const { POST: askPostHandler } = await import("@/app/api/xchat/ask/route");

  const askUrl = new URL("/api/xchat/ask", request.url);

  // Reconstruct a clean Request with the exact headers the ask route expects
  const askRequest = new Request(askUrl, {
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
        : {}),
      // correlation / request ids if present
      ...(request.headers.get("x-correlation-id")
        ? { "x-correlation-id": request.headers.get("x-correlation-id")! }
        : {}),
      ...(request.headers.get("x-request-id")
        ? { "x-request-id": request.headers.get("x-request-id")! }
        : {}),
    },
    body: bodyText,
    signal: request.signal,
    cache: "no-store",
  });

  let askRes: Response;
  try {
    askRes = await askPostHandler(askRequest);
  } catch (e) {
    return Response.json(
      {
        error: "xchat_stream_ask_delegate_failed",
        details: e instanceof Error ? e.message : String(e),
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

  // JSON fallback (options scan, watchlist, etc. still work)
  const fallbackText = await askRes.text();
  return new Response(fallbackText, {
    status: askRes.status,
    headers: {
      ...Object.fromEntries(limiterHeaders.entries()),
      "content-type": askRes.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });
}

/**
 * Next pipes the route `Response` body to the client. Undici / Spring can throw **`UND_ERR_SOCKET`**
 * (`other side closed`) after chunks — that surfaces as **`failed to pipe response`** and a bogus **500**.
 * Re-chunk through a pull-driven stream so read errors **close** the outbound stream instead of rejecting the pipe.
 */
function wrapBffProxiedStreamForNextPipe(proxied: Response): Response {
  const ct = proxied.headers.get("content-type") ?? "";
  if (!proxied.body || !ct.includes("text/event-stream")) {
    return proxied;
  }
  const reader = proxied.body.getReader();
  const wrapped = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        if (value && value.byteLength > 0) {
          controller.enqueue(value);
        }
      } catch {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
  const headers = new Headers(proxied.headers);
  headers.delete("content-length");
  return new Response(wrapped, { status: proxied.status, statusText: proxied.statusText, headers });
}

function pickXchatLimiterHeaders(src: Headers): Headers {
  const out = new Headers();
  const names = [
    "x-xchat-limit-remaining-minute",
    "x-xchat-limit-remaining-hour",
    "x-xchat-limit-remaining-day",
    "x-xchat-limit-hourly",
    "x-xchat-limit-daily",
    "retry-after",
  ] as const;
  for (const n of names) {
    const v = src.get(n);
    if (v) out.set(n, v);
  }
  return out;
}