import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getStrategyJobsBffUnavailableMessage, proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { canUserLogin } from "@/modules/identity/authorization";

export async function POST(request: Request) {
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

  return NextResponse.json(
    {
      error: "service_unavailable",
      message: getStrategyJobsBffUnavailableMessage()
    },
    { status: 503 }
  );
}