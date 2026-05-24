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
  if (proxied) {
    return proxied;
  }

  const url = new URL(request.url);
  const parsed = parseHotPicksQueryFromUrl(url);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error, message: "Invalid hot picks query parameters" },
      { status: 400 }
    );
  }

  const data = await runHotPicksScanNextFallback(session, parsed);
  const res = NextResponse.json({ data });
  res.headers.set("x-cache-hit", data.meta.cacheHit ? "1" : "0");
  res.headers.set("Cache-Control", "private, max-age=60");
  return res;
}
