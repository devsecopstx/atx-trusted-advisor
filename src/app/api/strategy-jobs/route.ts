import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { canCreateStrategyJobFromApp } from "@/modules/identity/authorization";

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return NextResponse.json(
    {
      error: "service_unavailable",
      message: "Strategy orchestrator requires ATXFINANCE_BACKEND_ORIGIN (Spring BFF)."
    },
    { status: 503 }
  );
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canCreateStrategyJobFromApp(session.roles)) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Strategy job creation is limited to advisor/operator roles."
      },
      { status: 403 }
    );
  }
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return NextResponse.json(
    {
      error: "service_unavailable",
      message: "Strategy orchestrator requires ATXFINANCE_BACKEND_ORIGIN (Spring BFF)."
    },
    { status: 503 }
  );
}
