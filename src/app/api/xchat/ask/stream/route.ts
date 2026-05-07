import { NextResponse } from "next/server";

import { proxyPortfolioRequestToBackend, releaseUnusedProxyResponse } from "@/lib/backend-bff";

/**
 * SSE / streaming entry for future xChat tool-loop responses. Proxies to Spring when BFF is on
 * (body stream forwarded without buffering). Local Next returns **501** until a native stream path ships.
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

  return NextResponse.json(
    {
      error: "xchat_stream_local_not_implemented",
      detail:
        "Streaming ask is not implemented on Next-only runtimes. Set ATXFINANCE_BACKEND_ORIGIN for the JVM SSE stub, or use POST /api/xchat/ask."
    },
    { status: 501 }
  );
}
