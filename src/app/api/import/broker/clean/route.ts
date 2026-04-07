import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";
import {
    bumpPortfolioWorkspaceContentRev,
    deleteAllPositionsForPortfolio,
    deleteScheduledTasksForPortfolioCategory,
    getPortfolioByIdForSessionUser
} from "@/modules/core-admin/repository";
import { deleteAppBrokerImportJobsForPortfolioUser } from "@/modules/portfolio-import/app-broker-import-job";

const bodySchema = z.object({
  portfolioId: z.string().trim().min(1)
});

/**
 * POST /api/import/broker/clean
 * Destructive: removes all holdings (positions) for the portfolio, broker import job rows, and
 * portfolio-bound `sync-broker` scheduled tasks so the user can re-import from a clean slate.
 */
export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { portfolioId } = parsed.data;

  const portfolio = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const syncTasksDeleted = await deleteScheduledTasksForPortfolioCategory({
    portfolioId,
    category: "sync-broker",
    tenantId: session.tenantId
  });

  const positionsDeleted = await deleteAllPositionsForPortfolio({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });

  const importJobsDeleted = await deleteAppBrokerImportJobsForPortfolioUser({
    portfolioIdHex: portfolioId,
    userId: session.userId,
    tenantId: session.tenantId
  });

  if (importJobsDeleted > 0 || syncTasksDeleted > 0) {
    await bumpPortfolioWorkspaceContentRev({
      userId: session.userId,
      portfolioId,
      tenantId: session.tenantId
    });
  }

  return NextResponse.json({
    data: {
      positionsDeleted,
      importJobsDeleted,
      syncTasksDeleted
    }
  });
}
