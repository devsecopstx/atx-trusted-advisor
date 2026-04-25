import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { attachIbkrCorrelationId, ibkrJsonResponse, newIbkrCorrelationId } from "@/modules/ibkr-integration/ibkr-correlation";

export async function POST() {
  const correlationId = newIbkrCorrelationId();
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return attachIbkrCorrelationId(session, correlationId);
  }
  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_disabled" }, { status: 404 });
  }
  return ibkrJsonResponse(
    correlationId,
    {
      error: "not_implemented",
      stage: "ibkr_order_preview_phase_pending",
      hint: "Order preview/confirm is planned after paper-session maturity."
    },
    { status: 501 }
  );
}
