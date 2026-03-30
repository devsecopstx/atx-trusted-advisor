import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import { deletePortfolioAccountForUser, updatePortfolioAccountForUser } from "@/modules/core-admin/repository";
import { accountOutlookValues } from "@/modules/core-admin/types";

const deskRiskEnum = z.enum(["conservative", "balanced", "growth"]);

const patchAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    cashBalance: z.number().finite().nonnegative().optional(),
    extAccountId: z.string().trim().min(1).max(200).optional(),
    riskProfile: z.union([deskRiskEnum, z.null()]).optional(),
    outlook: z.union([z.enum(accountOutlookValues), z.null()]).optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required"
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ portfolioId: string; accountId: string }> }
) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;
  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updatePortfolioAccountForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountId,
    ...parsed.data
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ portfolioId: string; accountId: string }> }
) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;
  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  const ok = await deletePortfolioAccountForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountId
  });
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "Could not delete account. Ensure the account exists and the portfolio has more than one account."
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
