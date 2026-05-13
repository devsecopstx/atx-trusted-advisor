import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { loadDefaultPortfolioSummaryForSession } from "@/lib/portfolio-default-summary-for-session";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";
import { findPortfolioWorkspaceSnapshotRow } from "@/modules/xchat/portfolio-workspace-snapshot-repository";

function parseWorkspaceContentRev(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get("workspaceContentRev");
  if (raw === null || raw === "") {
    return 0;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

function parseIncludeSnapshot(searchParams: URLSearchParams): boolean {
  const raw = searchParams.get("includeSnapshot");
  if (raw === null || raw === "") {
    return true;
  }
  return raw !== "0" && raw.toLowerCase() !== "false";
}

/**
 * Bundled read for product shell pages — proxies to Spring [ReadFacadeController] when BFF is on;
 * Mongo fallback matches `GET /api/portfolios/default` + optional workspace snapshot row (no `structured` — use JVM path for that).
 */
export async function GET(request: Request) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const t0 = performance.now();
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }

  const summary = await loadDefaultPortfolioSummaryForSession(session);
  if (summary instanceof NextResponse) {
    return summary;
  }

  const { searchParams } = new URL(request.url);
  const rev = parseWorkspaceContentRev(searchParams);
  if (rev === null) {
    return NextResponse.json({ error: "Invalid workspaceContentRev" }, { status: 400 });
  }
  const includeSnapshot = parseIncludeSnapshot(searchParams);
  const portfolioId = summary.data._id as string;

  let workspaceSnapshot: Record<string, unknown> | null = null;
  if (includeSnapshot) {
    const row = await findPortfolioWorkspaceSnapshotRow({
      portfolioIdHex: portfolioId,
      workspaceContentRev: rev
    });
    if (row) {
      workspaceSnapshot = {
        preload: row.preload,
        workspaceContentRev: row.workspaceContentRev,
        materializedAt: row.materializedAt.toISOString(),
        source: row.source,
        cache: { redis: "skipped", source: "next_mongo" }
      };
    }
  }

  const totalMs = Math.round(performance.now() - t0);
  return NextResponse.json(
    {
      data: {
        facadeVersion: 1,
        defaultPortfolio: summary.data,
        workspaceSnapshot
      }
    },
    {
      headers: {
        "X-Atx-Read-Facade-Total-Ms": String(totalMs),
        "X-Atx-Read-Facade-Backend": "next_mongo"
      }
    }
  );
}
