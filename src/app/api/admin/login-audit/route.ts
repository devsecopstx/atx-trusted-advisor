import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { listLoginAuditRecords } from "@/modules/identity/login-audit";

const querySchema = z.object({
  outcome: z.enum(["success", "failure"]).optional(),
  clientIp: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    outcome: url.searchParams.get("outcome") ?? undefined,
    clientIp: url.searchParams.get("clientIp") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const rows = await listLoginAuditRecords({
    limit: parsed.data.limit,
    outcome: parsed.data.outcome,
    clientIp: parsed.data.clientIp,
    fromDate: parsed.data.from ? new Date(parsed.data.from) : undefined,
    toDate: parsed.data.to ? new Date(parsed.data.to) : undefined
  });

  return NextResponse.json({
    data: rows.map((r) => ({
      _id: r._id?.toHexString(),
      outcome: r.outcome,
      provider: r.provider,
      errorCode: r.errorCode,
      clientIp: r.clientIp,
      country: r.country,
      userAgent: r.userAgent,
      userId: r.userId,
      xUserId: r.xUserId,
      username: r.username,
      email: r.email,
      createdAt: r.createdAt.toISOString()
    }))
  });
}
