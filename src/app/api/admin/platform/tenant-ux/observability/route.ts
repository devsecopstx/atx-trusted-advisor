import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import {
  listTenantUxObservabilityEvents,
  listTenantUxObservabilityReplay
} from "@/modules/platform/tenant-ux-observability-repository";

export async function GET(request: Request) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() || undefined;
  const replayTenantId = url.searchParams.get("replayTenantId")?.trim() || undefined;
  const events = await listTenantUxObservabilityEvents({
    tenantId,
    limit: 50
  });
  const counters = {
    tenant_ux_route_forbidden_total: events.filter(
      (event) => event.metric === "tenant_ux_route_forbidden_total"
    ).length,
    tenant_ux_policy_fetch_latency_ms_p95: (() => {
      const samples = events
        .filter((event) => typeof event.ms === "number" && event.ms >= 0)
        .map((event) => event.ms as number)
        .sort((a, b) => a - b);
      if (samples.length === 0) {
        return null;
      }
      const idx = Math.floor(samples.length * 0.95);
      return samples[Math.min(idx, samples.length - 1)];
    })(),
    tenant_ux_policy_unavailable_total: events.filter(
      (event) => event.metric === "tenant_ux_policy_unavailable_total"
    ).length
  };
  const replay =
    replayTenantId && replayTenantId.length > 0
      ? await listTenantUxObservabilityReplay({ tenantId: replayTenantId, sinceHours: 24 })
      : [];

  return NextResponse.json({
    data: {
      counters,
      events,
      replay
    }
  });
}
