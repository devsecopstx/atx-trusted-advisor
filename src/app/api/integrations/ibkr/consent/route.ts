import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { upsertIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import { IBKR_CONSENT_COPY_SUMMARY } from "@/modules/ibkr-integration/constants";
import {
    attachIbkrCorrelationId,
    ibkrJsonResponse,
    newIbkrCorrelationId
} from "@/modules/ibkr-integration/ibkr-correlation";

const bodySchema = z.object({
  accepted: z.boolean()
});

export async function POST(request: Request) {
  const correlationId = newIbkrCorrelationId();
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return attachIbkrCorrelationId(session, correlationId);
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_disabled" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return ibkrJsonResponse(correlationId, { error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return ibkrJsonResponse(
      correlationId,
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const doc = await upsertIbkrConsent({
    userIdHex: session.userId,
    tenantIdHex: session.tenantId,
    accepted: parsed.data.accepted
  });

  return ibkrJsonResponse(correlationId, {
    data: {
      accepted: Boolean(doc?.consentedAt),
      consentCopy: IBKR_CONSENT_COPY_SUMMARY,
      updatedAt: doc?.updatedAt?.toISOString() ?? null
    }
  });
}
