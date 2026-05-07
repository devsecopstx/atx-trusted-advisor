import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend, releaseUnusedProxyResponse } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { findPortfolioWorkspaceSnapshotRow } from "@/modules/xchat/portfolio-workspace-snapshot-repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

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

/**
 * Redis-backed workspace snapshot on Spring when BFF is on; Next + Mongo fallback matches
 * `GET …/workspace-snapshot` payload with optional `cache` on JVM responses.
 */
export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request.clone());
  if (proxied) {
    if (proxied.status === 404) {
      releaseUnusedProxyResponse(proxied);
    } else {
      return proxied;
    }
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const rev = parseWorkspaceContentRev(new URL(request.url).searchParams);
  if (rev === null) {
    return NextResponse.json({ error: "Invalid workspaceContentRev" }, { status: 400 });
  }

  const row = await findPortfolioWorkspaceSnapshotRow({
    portfolioIdHex: portfolioId,
    workspaceContentRev: rev
  });
  if (!row) {
    return NextResponse.json({ error: "snapshot_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      preload: row.preload,
      workspaceContentRev: row.workspaceContentRev,
      materializedAt: row.materializedAt.toISOString(),
      source: row.source,
      cache: {
        redis: "skipped",
        source: "next_mongo"
      }
    }
  });
}
