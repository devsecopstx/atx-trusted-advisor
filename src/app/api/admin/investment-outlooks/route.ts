import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requirePlatformOpsSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { INVESTMENT_OUTLOOKS_COLLECTION } from "@/modules/portfolio/investment-outlooks";

export async function GET(request: Request) {
  const session = await requirePlatformOpsSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const platformWide = isGlobalAdmin(session.roles);
  const url = new URL(request.url);
  const tenantQuery = url.searchParams.get("tenantId")?.trim() ?? "";
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);

  const match: Record<string, unknown> = {};
  if (!platformWide) {
    if (!ObjectId.isValid(session.tenantId)) {
      return NextResponse.json({ error: "Invalid session tenant" }, { status: 400 });
    }
    match.tenantId = new ObjectId(session.tenantId);
  } else if (tenantQuery && ObjectId.isValid(tenantQuery)) {
    match.tenantId = new ObjectId(tenantQuery);
  }

  const db = await getDb();
  const rows = await db
    .collection(INVESTMENT_OUTLOOKS_COLLECTION)
    .aggregate([
      { $match: match },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: TENANT_PORTFOLIO_COLLECTION,
          localField: "portfolioId",
          foreignField: "_id",
          as: "portfolio"
        }
      },
      { $unwind: { path: "$portfolio", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          portfolioId: { $toString: "$portfolioId" },
          portfolioName: "$portfolio.name",
          portfolioUserId: {
            $cond: [
              { $ifNull: ["$portfolio", false] },
              { $toString: "$portfolio.userId" },
              null
            ]
          },
          tenantId: { $toString: "$tenantId" },
          updatedAt: 1,
          expiresAt: 1,
          symbolCount: { $size: { $ifNull: ["$symbols", []] } }
        }
      }
    ])
    .toArray();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    scope: platformWide ? "platform" : "tenant",
    rows
  });
}
