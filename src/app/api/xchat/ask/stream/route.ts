import { proxyPortfolioRequestToBackend, releaseUnusedProxyResponse } from "@/lib/backend-bff";
import {
    createPostAskSseReadableStream,
    resolveStreamChunkConfig,
    type XchatAskStreamMetaEvent
} from "@/modules/xchat/xchat-ask-stream-sse";

/**
 * SSE wrapper around the full non-streaming xChat tool loop (`POST /api/xchat/ask`).
 *
 * Emits `meta` (protocol + thread/model hints), `delta` (`{ c: string }` chunks of the final
 * markdown), then `done` (ask `data` without duplicated `content`/`response` bodies). Errors from
 * the delegate route are returned as JSON with the same status (not SSE).
 *
 * When BFF is on, the upstream JVM may still return its stub stream; that body is forwarded as-is.
 */
export async function POST(request: Request) {
  const proxied = await proxyPortfolioRequestToBackend(request.clone());
  if (proxied) {
    if (proxied.status === 404) {
      releaseUnusedProxyResponse(proxied);
    } else {
      return proxied;
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
        cookie: request.headers.get("cookie") ?? "",
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

  let payload: unknown;
  try {
    payload = await askRes.json();
  } catch {
    const fallbackText = await askRes.text();
    return new Response(fallbackText, {
      status: askRes.status,
      headers: {
        "content-type": askRes.headers.get("content-type") ?? "text/plain; charset=utf-8"
      }
    });
  }

  if (!askRes.ok || typeof payload !== "object" || payload === null || !("data" in payload)) {
    return Response.json(payload, {
      status: askRes.status,
      headers: limiterHeaders
    });
  }

  const data = (payload as { data: Record<string, unknown> }).data;
  const content =
    typeof data.content === "string"
      ? data.content
      : typeof data.response === "string"
        ? data.response
        : "";

  const metaRow =
    data.metadata && typeof data.metadata === "object" && data.metadata !== null
      ? (data.metadata as Record<string, unknown>)
      : {};

  const meta: XchatAskStreamMetaEvent = {
    v: 1,
    phase: "post_tool_loop",
    threadId: typeof metaRow.threadId === "string" ? metaRow.threadId : "",
    model:
      typeof metaRow.model === "string"
        ? metaRow.model
        : typeof data.model === "string"
          ? data.model
          : "",
    personaId: typeof metaRow.personaId === "string" ? metaRow.personaId : "",
    ...(typeof metaRow.durationMs === "number" ? { durationMs: metaRow.durationMs } : {}),
    ...(typeof metaRow.sourcesUsed === "number" ? { sourcesUsed: metaRow.sourcesUsed } : {})
  };

  const doneRest: Record<string, unknown> = { ...data };
  delete doneRest.content;
  delete doneRest.response;
  const { chunkChars, chunkDelayMs } = resolveStreamChunkConfig();
  const stream = createPostAskSseReadableStream({
    content,
    donePayload: doneRest,
    meta,
    chunkChars,
    chunkDelayMs
  });

  const headers = new Headers(limiterHeaders);
  headers.set("content-type", "text/event-stream; charset=utf-8");
  headers.set("cache-control", "no-cache, no-transform");
  headers.set("connection", "keep-alive");
  headers.set("x-accel-buffering", "no");

  return new Response(stream, { status: 200, headers });
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
