import { shouldProxyAdminUsersToBackend } from "@/lib/backend-bff";
import { BFF_PROXY_ROUTES, type BffProxyHttpMethod } from "@/lib/bff-proxy-routes";
import { getAtxfinanceBackendOrigin } from "@/lib/env";

const WRITE_METHODS: ReadonlySet<BffProxyHttpMethod> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type RegisteredWriteDisposition = {
  readonly method: BffProxyHttpMethod;
  readonly pathTemplate: string;
  readonly disposition: "spring_when_bff_gate_on" | "legacy_next_registered";
  readonly reason?: string;
};

/**
 * Static disposition of each **write** row in {@link BFF_PROXY_ROUTES} when the product BFF gate is on
 * (`shouldProxyAdminUsersToBackend()`), mirroring `src/lib/backend-bff.ts` skip flags. Not runtime request
 * telemetry — use for ownership inventory and onboarding.
 */
export function neverSpringReasonForBffRegisteredWrite(
  method: BffProxyHttpMethod,
  pathTemplate: string
): string | null {
  if (!WRITE_METHODS.has(method)) {
    return null;
  }
  if (pathTemplate.startsWith("/api/personas")) {
    return "Personas stay on Next Mongo (`shouldProxyPersonasRequestsToBackend` is false).";
  }
  if (pathTemplate === "/api/admin/access-requests" || pathTemplate.startsWith("/api/admin/access-requests/")) {
    return "Admin access-requests stay on Next (`shouldSkipAdminAccessRequestsBffProxy`).";
  }
  if (pathTemplate.startsWith("/api/admin/tasks") || pathTemplate === "/api/admin/scheduler/tick") {
    return "Admin scheduled tasks stay on Next (`shouldProxyAdminScheduledTasksToBackend` is false).";
  }
  if (
    pathTemplate.startsWith("/api/admin/delivery-channels") ||
    (pathTemplate.startsWith("/api/admin/portfolios/") && pathTemplate.includes("/delivery-channels"))
  ) {
    return "Admin delivery-channels stay on Next (`shouldProxyAdminDeliveryChannelsToBackend` is false).";
  }
  if (
    (pathTemplate === "/api/portfolios/{portfolioId}/watchlist" ||
      pathTemplate === "/api/admin/portfolios/{portfolioId}/watchlist") &&
    method === "PATCH"
  ) {
    return "Watchlist PATCH stays on Next (desk/Yahoo parity; admin + app-user BFF skips).";
  }
  if (pathTemplate === "/api/xchat/ask/stream" && method === "POST") {
    return "xChat SSE defaults to in-process Next; Spring only when XCHAT_SSE_PROXY_BACKEND is on.";
  }
  return null;
}

export function listBffRegisteredWriteDispositions(): readonly RegisteredWriteDisposition[] {
  return BFF_PROXY_ROUTES.filter((r) => WRITE_METHODS.has(r.method)).map((r) => {
    const reason = neverSpringReasonForBffRegisteredWrite(r.method, r.path);
    return {
      method: r.method,
      pathTemplate: r.path,
      disposition: reason ? "legacy_next_registered" : "spring_when_bff_gate_on",
      ...(reason ? { reason } : {})
    };
  });
}

export function summarizeBffRegisteredWriteHealth(): {
  readonly bffRegisteredWritesTotal: number;
  readonly springAuthoritativeWhenGateOn: number;
  readonly legacyNextRegisteredWrites: number;
  readonly springSharePercentWhenGateOn: number | null;
  readonly legacyRegisteredSharePercent: number | null;
} {
  const rows = listBffRegisteredWriteDispositions();
  const total = rows.length;
  const legacy = rows.filter((r) => r.disposition === "legacy_next_registered").length;
  const spring = total - legacy;
  return {
    bffRegisteredWritesTotal: total,
    springAuthoritativeWhenGateOn: spring,
    legacyNextRegisteredWrites: legacy,
    springSharePercentWhenGateOn: total > 0 ? Math.round((100 * spring) / total) : null,
    legacyRegisteredSharePercent: total > 0 ? Math.round((100 * legacy) / total) : null
  };
}

function maskBackendHostHint(origin: string): string {
  try {
    const host = new URL(origin).hostname;
    if (host.length <= 8) {
      return `${host.slice(0, 2)}…`;
    }
    return `${host.slice(0, 4)}…${host.slice(-4)}`;
  } catch {
    return "(invalid URL)";
  }
}

export type DataPlaneWriteHealthPayload = {
  readonly catalog: ReturnType<typeof summarizeBffRegisteredWriteHealth>;
  readonly runtime: {
    readonly backendOriginConfigured: boolean;
    readonly backendOriginHostHint: string | null;
    readonly bffProductPlaneGateActive: boolean;
    readonly bffInactiveReason: "origin_unset" | "dev_loopback_skip" | null;
  };
  readonly registeredWriteRows: readonly RegisteredWriteDisposition[];
};

export function buildDataPlaneWriteHealthPayload(): DataPlaneWriteHealthPayload {
  const origin = getAtxfinanceBackendOrigin()?.trim();
  const configured = Boolean(origin && origin.length > 0);
  const gate = shouldProxyAdminUsersToBackend();
  let bffInactiveReason: DataPlaneWriteHealthPayload["runtime"]["bffInactiveReason"] = null;
  if (!configured) {
    bffInactiveReason = "origin_unset";
  } else if (!gate) {
    bffInactiveReason = "dev_loopback_skip";
  }

  return {
    catalog: summarizeBffRegisteredWriteHealth(),
    runtime: {
      backendOriginConfigured: configured,
      backendOriginHostHint: configured && origin ? maskBackendHostHint(origin) : null,
      bffProductPlaneGateActive: gate,
      bffInactiveReason: gate ? null : bffInactiveReason
    },
    registeredWriteRows: listBffRegisteredWriteDispositions()
  };
}
