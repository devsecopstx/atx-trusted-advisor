import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
  PositionValidationError,
  upsertPositionForAccount
} from "@/modules/core-admin/repository";

const upsertPositionSchema = z.object({
  portfolioId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  qty: z.number().positive(),
  avgCost: z.number().nonnegative()
});

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const payload = await request.json();
  const parsed = upsertPositionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const position = await upsertPositionForAccount({
      userId: session.userId,
      tenantId: session.tenantId,
      ...parsed.data
    });
    return NextResponse.json({ data: position }, { status: 201 });
  } catch (error) {
    if (error instanceof PositionValidationError) {
      const status =
        error.code === "ACCOUNT_NOT_FOUND" || error.code === "ACCOUNT_PORTFOLIO_MISMATCH"
          ? 404
          : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
