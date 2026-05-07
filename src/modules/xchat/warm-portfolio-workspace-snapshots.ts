import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import type { Portfolio } from "@/modules/core-admin/types";

import { upsertPortfolioWorkspaceSnapshot } from "@/modules/xchat/portfolio-workspace-snapshot-repository";
import {
    buildWorkspaceSnapshotPreloadFromPortfolio,
    normalizeWorkspaceContentRev,
    type WorkspaceSnapshotContext
} from "@/modules/xchat/workspace-snapshot-for-prompt";

const DEFAULT_MAX_PORTFOLIOS_PER_WARM = 400;

function parseMaxPortfolios(): number {
  const raw = process.env.PORTFOLIO_SNAPSHOT_WARM_MAX_PORTFOLIOS?.trim();
  if (!raw) {
    return DEFAULT_MAX_PORTFOLIOS_PER_WARM;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_MAX_PORTFOLIOS_PER_WARM;
  }
  return Math.min(5000, n);
}

function portfolioUserIdHex(p: Portfolio): string | null {
  const u = p.userId;
  if (typeof u === "string" && u.trim()) {
    return u.trim();
  }
  if (u && typeof u === "object" && "toHexString" in u && typeof u.toHexString === "function") {
    return (u as ObjectId).toHexString();
  }
  return null;
}

/**
 * After a successful tenant scanner (options / watchlist quotes / price / Phase-3), pre-materialize
 * workspace snapshots into `portfolio_workspace_snapshots` so xChat can skip cold Mongo joins when rev matches.
 * Best-effort; capped per tenant via `PORTFOLIO_SNAPSHOT_WARM_MAX_PORTFOLIOS`.
 */
export async function warmPortfolioWorkspaceSnapshotsForTenant(input: {
  tenantId: ObjectId;
}): Promise<{ attempted: number; written: number; errors: number }> {
  const max = parseMaxPortfolios();
  const db = await getDb();
  const cursor = db
    .collection<Portfolio>(TENANT_PORTFOLIO_COLLECTION)
    .find({ tenantId: input.tenantId })
    .project({ _id: 1, userId: 1, tenantId: 1, workspaceContentRev: 1, name: 1, isDefault: 1 })
    .limit(max);

  let attempted = 0;
  let written = 0;
  let errors = 0;

  for await (const doc of cursor) {
    const p = doc as Portfolio;
    if (!p._id) {
      continue;
    }
    const userId = portfolioUserIdHex(p);
    if (!userId) {
      continue;
    }
    attempted += 1;
    const portfolioIdHex = p._id.toHexString();
    const tenantHex = p.tenantId?.toHexString();
    const ctx: WorkspaceSnapshotContext = {
      userId,
      tenantId: tenantHex,
      workspacePortfolioId: portfolioIdHex
    };
    try {
      const preload = await buildWorkspaceSnapshotPreloadFromPortfolio(
        ctx,
        p as Portfolio & { _id: ObjectId },
        true
      );
      if (!preload) {
        continue;
      }
      const rev = normalizeWorkspaceContentRev(p);
      await upsertPortfolioWorkspaceSnapshot({
        portfolioIdHex,
        userId,
        tenantId: tenantHex,
        workspaceContentRev: rev,
        preload,
        source: "scanner_warm"
      });
      written += 1;
    } catch {
      errors += 1;
    }
  }

  return { attempted, written, errors };
}
