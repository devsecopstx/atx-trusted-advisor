import { NextResponse } from "next/server";

import type { AdminOpsSummaryBackend, AdminOpsSummaryResponse } from "@/lib/admin-ops-summary-contract";
import { requirePlatformOpsSession } from "@/lib/api-auth";
import { APP_VERSION } from "@/lib/app-version";
import { getAtxfinanceBackendOrigin } from "@/lib/env";
import { getDb } from "@/lib/mongodb";
import { checkRedisHealth } from "@/lib/redis-client";
import { collectPlatformOpsMetrics } from "@/modules/admin/platform-ops-metrics";
import { createAuditEvent } from "@/modules/audit/repository";
import { getAccountOutlookContextCacheStats } from "@/modules/xchat/account-outlook-context-cache";

const BACKEND_HEALTH_TIMEOUT_MS = 6000;

type BackendOpsSlice = AdminOpsSummaryBackend;

function parseBackendRedis(redis: unknown): { status: string; detail?: string } {
  if (redis === "ok") {
    return { status: "ok" };
  }
  if (redis && typeof redis === "object") {
    const r = redis as Record<string, unknown>;
    const st = r.status;
    if (st === "ok" || st === "error" || st === "skipped") {
      const reason = typeof r.reason === "string" ? r.reason : undefined;
      const message = typeof r.message === "string" ? r.message : undefined;
      return { status: String(st), detail: reason ?? message };
    }
  }
  return { status: "unknown" };
}

function parseBackendHealth(json: unknown): Pick<
  AdminOpsSummaryBackend,
  "service" | "timeUtc" | "mongoStatus" | "redisStatus" | "redisDetail"
> {
  if (!json || typeof json !== "object") {
    return { redisStatus: "unknown" };
  }
  const root = json as Record<string, unknown>;
  const service = typeof root.service === "string" ? root.service : undefined;
  const timeUtc = typeof root.time === "string" ? root.time : undefined;
  const details = root.details as Record<string, unknown> | undefined;
  const mongo = details?.mongo as Record<string, unknown> | undefined;
  const mongoStatus = typeof mongo?.status === "string" ? mongo.status : undefined;
  const { status: redisStatus, detail: redisDetail } = parseBackendRedis(details?.redis);
  return { service, timeUtc, mongoStatus, redisStatus, redisDetail };
}

async function fetchBackendOps(origin: string): Promise<BackendOpsSlice> {
  const url = `${origin.replace(/\/$/, "")}/api/backend/health`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), BACKEND_HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ac.signal,
      headers: { accept: "application/json" }
    });
    if (!res.ok) {
      return {
        role: "compute_backend",
        label: "Spring (atxfinance-backend)",
        configured: true,
        origin,
        httpReachable: true,
        httpStatus: res.status,
        fetchError: `HTTP ${String(res.status)}`
      };
    }
    const json: unknown = await res.json();
    const parsed = parseBackendHealth(json);
    return {
      role: "compute_backend",
      label: "Spring (atxfinance-backend)",
      configured: true,
      origin,
      httpReachable: true,
      httpStatus: res.status,
      ...parsed
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      role: "compute_backend",
      label: "Spring (atxfinance-backend)",
      configured: true,
      origin,
      httpReachable: false,
      fetchError: msg
    };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const session = await requirePlatformOpsSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let nextDatabaseName: string | null = null;
  let nextDbOk = false;
  let nextDbError: string | undefined;
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    nextDbOk = true;
    nextDatabaseName = db.databaseName;
  } catch (e) {
    nextDbOk = false;
    nextDbError = e instanceof Error ? e.message : String(e);
  }

  const redis = await checkRedisHealth();
  const outlookContextCache = await getAccountOutlookContextCacheStats();
  const backendOrigin = getAtxfinanceBackendOrigin();

  const platformOps = await collectPlatformOpsMetrics({
    session: { tenantId: session.tenantId, roles: session.roles }
  });

  const backend: BackendOpsSlice = !backendOrigin
    ? {
        role: "compute_backend",
        label: "Spring (atxfinance-backend)",
        configured: false,
        origin: null,
        httpReachable: false,
        skippedReason:
          "ATXFINANCE_BACKEND_ORIGIN unset — JVM / Cloud Run backend not wired for this Next deployment."
      }
    : await fetchBackendOps(backendOrigin);

  await createAuditEvent({
    entityType: "system",
    entityId: "ops-summary",
    action: "ops_summary_viewed",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      nextDbOk,
      backendConfigured: backend.configured,
      backendHttpReachable: backend.httpReachable
    }
  });

  const body: AdminOpsSummaryResponse = {
    generatedAt: new Date().toISOString(),
    sessionTenantId: session.tenantId,
    nextApp: {
      role: "frontend",
      label: "Next.js core app (this service)",
      service: "atxfinance-core-app",
      version: APP_VERSION,
      database: {
        ok: nextDbOk,
        name: nextDatabaseName,
        error: nextDbError
      },
      redis,
      outlookContextCache
    },
    backend,
    platformOps
  };

  return NextResponse.json(body);
}
