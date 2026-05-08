import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { bulkExpireActivePortfolioPriceAlertsForTenant } from "@/modules/price-alerts/portfolio-price-alerts-repository";

const bodySchema = z.object({
  tenantId: z.string().trim().min(1)
});

/** Admin bulk-expire for NL `portfolio_price_alerts` (Architect spec — ops reset). */
export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const tenantId = parsed.data.tenantId;
  const expiredCount = await bulkExpireActivePortfolioPriceAlertsForTenant(tenantId);

  await createAuditEvent({
    entityType: "tenant",
    entityId: tenantId,
    action: "portfolio_price_alerts_bulk_expire",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: { expiredCount }
  }).catch(() => {});

  return NextResponse.json({ ok: true, expiredCount });
}
