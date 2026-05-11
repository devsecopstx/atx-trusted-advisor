import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import { hnwiGuardrailsPartialSchema } from "@/modules/core-admin/portfolio-account-hnwi-guardrails";
import {
    deletePortfolioAccountForUser,
    listPortfolioAccounts,
    updatePortfolioAccountForUser
} from "@/modules/core-admin/repository";
import {
    accountOutlookValues,
    accountTypeValues,
    parseAccountOutlook
} from "@/modules/core-admin/types";

const deskRiskEnum = z.enum(["conservative", "balanced", "growth"]);

const hnwiGuardrailsPatchField = z.union([hnwiGuardrailsPartialSchema, z.null()]);

/** Maps legacy desk slugs (e.g. growth, balanced) to canonical bullish | neutral | bearish before enum parse. */
const outlookPatchField = z.preprocess(
  (raw: unknown) => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    if (typeof raw !== "string") return raw;
    return parseAccountOutlook(raw);
  },
  z.union([z.enum(accountOutlookValues), z.null()]).optional()
);

const patchAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    cashBalance: z.number().finite().nonnegative().optional(),
    extAccountId: z.string().trim().min(1).max(200).optional(),
    type: z.enum(accountTypeValues).optional(),
    riskProfile: z.union([deskRiskEnum, z.null()]).optional(),
    outlook: outlookPatchField,
    outlookRefreshEnabled: z.boolean().optional(),
    hnwiGuardrails: hnwiGuardrailsPatchField.optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required"
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ portfolioId: string; accountId: string }> }
) {
  const proxied = await proxyPortfolioRequestToBackend(request);
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

  const existing = (
    await listPortfolioAccounts({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId
    })
  ).find((account) => account._id?.toHexString() === accountId);
  if (!existing?._id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (existing.brokerImportLocked && parsed.data.type !== undefined) {
    return NextResponse.json(
      {
        error:
          "Broker type is locked after a CSV import. You can still update the account ref from Account details."
      },
      { status: 409 }
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
  const proxied = await proxyPortfolioRequestToBackend(request);
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
