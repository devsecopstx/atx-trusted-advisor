import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getDefaultPortfolio } from "@/modules/core-admin/repository";
import { resolveAccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const portfolioIdRaw = searchParams.get("portfolioId")?.trim();
  const portfolioIdHex =
    portfolioIdRaw && /^[a-f\d]{24}$/i.test(portfolioIdRaw)
      ? portfolioIdRaw
      : (await getDefaultPortfolio(session.userId, { tenantId: session.tenantId }))?._id?.toHexString() ||
        "";

  if (!portfolioIdHex) {
    return NextResponse.json({
      data: {
        portfolioId: null,
        marketOutlookLabel: null,
        lastOutlookRefreshAt: null
      }
    });
  }

  const startedAt = Date.now();
  const ctx = await resolveAccountOutlookContextForXchat({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioIdHex
  });
  const fetchMs = Math.max(0, Date.now() - startedAt);

  return NextResponse.json(
    {
      data: {
        portfolioId: portfolioIdHex,
        marketOutlookLabel: ctx?.marketOutlookLabel ?? null,
        riskLevelLabel: ctx?.riskLevelLabel ?? null,
        lastOutlookRefreshAt: ctx?.lastOutlookRefreshAt?.toISOString() ?? null,
        outlookRefreshSource: ctx?.outlookRefreshSource ?? null,
        fetchMs
      }
    },
    {
      headers: {
        "Server-Timing": `outlook-context-fetch;dur=${fetchMs}`
      }
    }
  );
}
