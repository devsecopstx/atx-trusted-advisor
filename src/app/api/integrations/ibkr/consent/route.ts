import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { upsertIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import { IBKR_CONSENT_COPY_SUMMARY } from "@/modules/ibkr-integration/constants";

const bodySchema = z.object({
  accepted: z.boolean()
});

export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "ibkr_disabled" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const doc = await upsertIbkrConsent({
    userIdHex: session.userId,
    tenantIdHex: session.tenantId,
    accepted: parsed.data.accepted
  });

  return NextResponse.json({
    data: {
      accepted: Boolean(doc?.consentedAt),
      consentCopy: IBKR_CONSENT_COPY_SUMMARY,
      updatedAt: doc?.updatedAt?.toISOString() ?? null
    }
  });
}
