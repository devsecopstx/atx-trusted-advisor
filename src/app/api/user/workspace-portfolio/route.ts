import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { WORKSPACE_PORTFOLIO_COOKIE_NAME } from "@/lib/workspace-portfolio-cookie";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  portfolioId: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const portfolioIdNorm = normalizeMongoObjectIdParam(parsed.data.portfolioId);
  if (!ObjectId.isValid(portfolioIdNorm)) {
    return NextResponse.json({ error: "Invalid portfolio id" }, { status: 400 });
  }

  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const allowed = portfolios.some((p) => p._id?.toHexString() === portfolioIdNorm);
  if (!allowed) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(WORKSPACE_PORTFOLIO_COOKIE_NAME, portfolioIdNorm, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  });
  return res;
}
