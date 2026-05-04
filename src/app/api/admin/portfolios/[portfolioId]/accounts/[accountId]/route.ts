import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { hnwiGuardrailsPartialSchema } from "@/modules/core-admin/portfolio-account-hnwi-guardrails";
import {
    adminDeleteAccountForPortfolio,
    adminUpdatePortfolioAccount,
    DEFAULT_ACCOUNT_CASH_BALANCE
} from "@/modules/core-admin/repository";
import type { Account } from "@/modules/core-admin/types";
import { accountOutlookValues, accountTypeValues, parseAccountOutlook } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string; accountId: string }>;
};

function serializeAccount(a: Account) {
  return {
    _id: a._id!.toHexString(),
    tenantId: a.tenantId?.toHexString(),
    userId: a.userId,
    portfolioId: a.portfolioId.toHexString(),
    name: a.name,
    type: a.type,
    extAccountId: a.extAccountId,
    cashBalance:
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance)
        ? a.cashBalance
        : DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: a.isDefault,
    riskProfile: a.riskProfile ?? null,
    outlook: parseAccountOutlook(a.outlook),
    hnwiGuardrails: a.hnwiGuardrails ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

const hnwiGuardrailsPatchField = z.union([hnwiGuardrailsPartialSchema, z.null()]);

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    cashBalance: z.number().finite().nonnegative().optional(),
    extAccountId: z.preprocess(
      (val) => {
        if (val === undefined || val === null) {
          return undefined;
        }
        if (typeof val !== "string") {
          return val;
        }
        const t = val.trim();
        return t === "" ? undefined : t;
      },
      z.string().min(1).max(200).optional()
    ),
    type: z.enum(accountTypeValues).optional(),
    isDefault: z.boolean().optional(),
    riskProfile: z
      .union([z.enum(["conservative", "balanced", "growth"]), z.null()])
      .optional(),
    outlook: z.union([z.enum(accountOutlookValues), z.null()]).optional(),
    hnwiGuardrails: hnwiGuardrailsPatchField.optional()
  })
  .refine(
    (b) =>
      b.cashBalance !== undefined ||
      b.type !== undefined ||
      b.isDefault === true ||
      b.riskProfile !== undefined ||
      b.outlook !== undefined ||
      b.hnwiGuardrails !== undefined ||
      (typeof b.name === "string" && b.name.trim().length > 0) ||
      (typeof b.extAccountId === "string" && b.extAccountId.length > 0),
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;

  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await adminUpdatePortfolioAccount({
    portfolioId,
    accountId,
    name: parsed.data.name,
    cashBalance: parsed.data.cashBalance,
    extAccountId: parsed.data.extAccountId,
    type: parsed.data.type,
    isDefault: parsed.data.isDefault === true ? true : undefined,
    riskProfile: parsed.data.riskProfile,
    outlook: parsed.data.outlook,
    hnwiGuardrails: parsed.data.hnwiGuardrails
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeAccount(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;

  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
  }

  const ok = await adminDeleteAccountForPortfolio({ portfolioId, accountId });
  if (!ok) {
    return NextResponse.json(
      { error: "Cannot delete (not found, or last account in portfolio)" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
