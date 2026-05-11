import { randomUUID } from "node:crypto";

import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getInvestmentOutlookRefreshEnabled } from "@/lib/feature-flags";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { effectiveWorkspaceLimitsForTenantAndPlan } from "@/lib/tenant-workspace-limits";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    listPortfolioAccounts,
    refreshPortfolioAccountInvestmentOutlookForUser
} from "@/modules/core-admin/repository";
import { getCoreUserById } from "@/modules/identity/repository";
import { invalidateAccountOutlookContextCache } from "@/modules/xchat/account-outlook-context-cache";

/**
 * Shared POST handler for manual investment outlook refresh (timestamp + audit).
 * Call after auth + portfolio/account ownership checks (and optional BFF proxy).
 */
export async function handlePortfolioAccountOutlookRefreshPost(input: {
  request: Request;
  session: SessionUser;
  portfolioId: string;
  accountId: string;
}): Promise<NextResponse> {
  const { request, session, portfolioId, accountId } = input;

  const tenantRow = ObjectId.isValid(session.tenantId)
    ? await getTenantByHexIdCached(session.tenantId)
    : null;
  const coreUser =
    ObjectId.isValid(session.userId) ? await getCoreUserById(new ObjectId(session.userId)) : null;
  const limits = await effectiveWorkspaceLimitsForTenantAndPlan(tenantRow, coreUser?.subscriptionPlan);
  const enabled = getInvestmentOutlookRefreshEnabled({
    envEnabled: getEnv().INVESTMENT_OUTLOOK_REFRESH_ENABLED === true,
    tenantLimits: limits
  });
  if (!enabled) {
    return NextResponse.json(
      { error: "Investment outlook refresh is disabled", code: "outlook_refresh_disabled" },
      { status: 403 }
    );
  }

  const correlationId =
    request.headers.get("x-correlation-id")?.trim() ||
    request.headers.get("x-request-id")?.trim() ||
    randomUUID();

  const accountsBefore = await listPortfolioAccounts({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  const prior = accountsBefore.find((a) => a._id?.toHexString() === accountId);

  const updated = await refreshPortfolioAccountInvestmentOutlookForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountId
  });

  if (!updated?._id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  void invalidateAccountOutlookContextCache({
    userId: session.userId,
    portfolioIdHex: portfolioId,
    tenantId: session.tenantId
  }).catch(() => {
    /* ignore */
  });

  await createAuditEvent({
    entityType: "portfolio_account",
    entityId: accountId,
    action: "investment_outlook_refresh",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      correlationId,
      trigger: "manual",
      portfolioId,
      previousOutlook: prior?.outlook ?? null,
      nextOutlook: updated.outlook ?? null,
      outlookConfidence:
        typeof updated.outlookConfidence === "number" ? updated.outlookConfidence : null,
      lastOutlookRefreshAt: updated.lastOutlookRefreshAt ?? null
    }
  });

  return NextResponse.json({ data: updated });
}
