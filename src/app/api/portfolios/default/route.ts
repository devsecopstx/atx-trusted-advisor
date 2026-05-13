import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { caughtErrorMessage } from "@/lib/caught-error";
import { loadDefaultPortfolioSummaryForSession } from "@/lib/portfolio-default-summary-for-session";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";

export async function GET(request: Request) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }

  const result = await loadDefaultPortfolioSummaryForSession(session);
  if (result instanceof NextResponse) {
    return result;
  }
  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDeniedPost = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDeniedPost) {
    return tenantDeniedPost;
  }

  try {
    const result = await loadDefaultPortfolioSummaryForSession(session);
    if (result instanceof NextResponse) {
      return result;
    }
    return NextResponse.json({ data: result.data, synced: true as const });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(`[api/portfolios/default POST] ${detail}`);
    return NextResponse.json(
      { error: "Could not sync your default portfolio. Please try again in a moment." },
      { status: 500 }
    );
  }
}
