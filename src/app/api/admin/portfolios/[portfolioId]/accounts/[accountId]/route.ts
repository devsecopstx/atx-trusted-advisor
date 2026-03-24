import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    adminDeleteAccountForPortfolio,
    adminUpdatePortfolioAccount,
    DEFAULT_ACCOUNT_CASH_BALANCE
} from "@/modules/core-admin/repository";
import type { Account } from "@/modules/core-admin/types";
import { accountTypeValues } from "@/modules/core-admin/types";

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
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    cashBalance: z.number().finite().nonnegative().optional(),
    extAccountId: z.string().trim().min(1).max(200).optional(),
    type: z.enum(accountTypeValues).optional(),
    isDefault: z.boolean().optional()
  })
  .refine((b) => Object.keys(b).length > 0, { message: "At least one field is required" });

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;

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
    isDefault: parsed.data.isDefault === true ? true : undefined
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeAccount(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;
  const ok = await adminDeleteAccountForPortfolio({ portfolioId, accountId });
  if (!ok) {
    return NextResponse.json(
      { error: "Cannot delete (not found, or last account in portfolio)" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
