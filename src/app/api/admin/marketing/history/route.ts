import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { listMarketingHistory } from "@/modules/marketing/repository";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = await listMarketingHistory(tenantIdHex, parsed.data.limit);
  return NextResponse.json({ data });
}
