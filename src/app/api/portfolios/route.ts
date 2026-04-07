import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import { adminCreatePortfolio } from "@/modules/core-admin/repository";

const postPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
  portfolioKind: z.enum(["real_estate", "investments"]).nullable().optional()
});

export async function POST(request: Request) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postPortfolioSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await adminCreatePortfolio({
    userId: session.userId,
    tenantId: session.tenantId,
    name: parsed.data.name,
    isDefault: parsed.data.isDefault,
    portfolioKind: parsed.data.portfolioKind ?? undefined
  });

  if (!created?._id) {
    return NextResponse.json(
      { error: "Could not create portfolio (limit reached or invalid data)" },
      { status: 403 }
    );
  }

  const data = await buildPortfolioSummaryPayload(session, created);
  return NextResponse.json({ data }, { status: 201 });
}
