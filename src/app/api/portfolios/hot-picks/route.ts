import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { canUserLogin } from "@/modules/identity/authorization";
import {
    parseHotPicksQueryFromUrl,
    runHotPicksScanNextFallback
} from "@/modules/portfolios/hot-picks-service";

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied && proxied.status < 500) {
    try {
      const peek = (await proxied.clone().json()) as { data?: { picks?: unknown[] } };
      if ((peek.data?.picks?.length ?? 0) > 0) {
        return proxied;
      }
    } catch {
      return proxied;
    }
    console.warn("[portfolios/hot-picks] BFF returned empty picks — using Next strategy engine");
  } else if (proxied) {
    console.warn(
      "[portfolios/hot-picks] BFF returned",
      proxied.status,
      "— using Next strategy engine"
    );
  }

  const url = new URL(request.url);
  const parsed = parseHotPicksQueryFromUrl(url);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error, message: "Invalid hot picks query parameters" },
      { status: 400 }
    );
  }

  const data = await runHotPicksScanNextFallback(session, parsed, {
    skipDedicatedHotPicks: proxied != null && proxied.status < 500,
    cookieHeader: request.headers.get("cookie") ?? undefined
  });
  const res = NextResponse.json({ data });
  res.headers.set("x-cache-hit", data.meta.cacheHit ? "1" : "0");
  res.headers.set("Cache-Control", "private, max-age=60");
  return res;
}
