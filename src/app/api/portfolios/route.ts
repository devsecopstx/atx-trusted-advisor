import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import { portfolioOutlookRequestSchema } from "@/lib/portfolio-outlook-api";
import { adminCreatePortfolio } from "@/modules/core-admin/repository";

const postPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
  broker_type: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  outlook: portfolioOutlookRequestSchema,
  portfolioKind: z.enum(["real_estate", "investments"]).nullable().optional()
});

export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
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
    broker_type: parsed.data.broker_type,
    outlook: parsed.data.outlook,
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
