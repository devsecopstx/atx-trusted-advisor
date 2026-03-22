import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import { updatePortfolioAccountForUser } from "@/modules/core-admin/repository";

const patchAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    cashBalance: z.number().finite().nonnegative().optional(),
    extAccountId: z.string().trim().min(1).max(200).optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required"
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ portfolioId: string; accountId: string }> }
) {
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
