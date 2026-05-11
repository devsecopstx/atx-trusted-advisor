import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getDefaultPortfolio } from "@/modules/core-admin/repository";
import { resolveAccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";
import { loadWorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

export const dynamic = "force-dynamic";

/**
 * Fire-and-forget friendly warm: loads workspace snapshot (Mongo + Redis/in-memory cache + Yahoo batch for watchlist symbols).
 * Call when `/xchat` mounts or workspace `portfolioId` changes so the first `atx_function` hit is cache-hot.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const portfolioIdRaw = searchParams.get("portfolioId")?.trim();
  const portfolioId =
    portfolioIdRaw && /^[a-f\d]{24}$/i.test(portfolioIdRaw) ? portfolioIdRaw : undefined;

  const portfolioIdHex =
    portfolioId ||
    (await getDefaultPortfolio(session.userId, { tenantId: session.tenantId }))?._id?.toHexString() ||
    "";

  await Promise.all([
    loadWorkspaceSnapshotPreload(
      {
        userId: session.userId,
        tenantId: session.tenantId,
        workspacePortfolioId: portfolioId
      },
      { snapshotQuoteNetwork: "live", coordinatingRequest: request }
    ),
    portfolioIdHex
      ? resolveAccountOutlookContextForXchat({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioIdHex
        })
      : Promise.resolve(null)
  ]);

  return NextResponse.json({ data: { warmed: true as const, portfolioId: portfolioIdHex || null } });
}
