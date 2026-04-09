import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
    getAtxfinanceBackendOrigin,
    getMongoConnectionLabel,
    getMongoEnvVarDiagnostics,
    getMongoUri,
    redactMongoUriCredentials,
    resolveEffectiveMongoDatabaseName
} from "@/lib/env";
import {
    isDockerComposeLoopbackVsServiceSkew,
    mongoFingerprintStrictEqual
} from "@/lib/mongo-connection-compare";
import { createAuditEvent } from "@/modules/audit/repository";

const BACKEND_HEALTH_TIMEOUT_MS = 6000;

type BackendMongoSnapshot = {
  ok: boolean;
  fingerprint: string | null;
  /** Resolved DB name from Spring health (when present). */
  database?: string | null;
  mongoStatus?: string;
  env?: {
    MONGODB_URI_present?: boolean;
    MONGODB_URI_B64_present?: boolean;
    SPRING_DATA_MONGODB_URI_present?: boolean;
  };
  error?: string;
};

function parseBackendHealthJson(json: unknown): BackendMongoSnapshot {
  if (!json || typeof json !== "object") {
    return { ok: false, fingerprint: null, error: "invalid_json" };
  }
  const root = json as Record<string, unknown>;
  const details = root.details as Record<string, unknown> | undefined;
  const mongo = details?.mongo as Record<string, unknown> | undefined;
  const env = details?.env as Record<string, unknown> | undefined;
  const host = typeof mongo?.host === "string" ? mongo.host : null;
  const database = typeof mongo?.database === "string" ? mongo.database : null;
  const mongoStatus = typeof mongo?.status === "string" ? mongo.status : undefined;
  const fingerprint =
    host && database ? `${host}/${database}` : host ? `${host}/` : null;
  return {
    ok: mongoStatus === "ok",
    fingerprint,
    database,
    mongoStatus,
    env: env
      ? {
          MONGODB_URI_present: Boolean(env.MONGODB_URI_present),
          MONGODB_URI_B64_present: Boolean(env.MONGODB_URI_B64_present),
          SPRING_DATA_MONGODB_URI_present: Boolean(env.SPRING_DATA_MONGODB_URI_present)
        }
      : undefined
  };
}

async function fetchBackendMongoSnapshot(origin: string): Promise<BackendMongoSnapshot> {
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
      return { ok: false, fingerprint: null, error: `http_${res.status}` };
    }
    const json: unknown = await res.json();
    return parseBackendHealthJson(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, fingerprint: null, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const uri = getMongoUri();
    const label = getMongoConnectionLabel();
    const nextEnv = getMongoEnvVarDiagnostics();
    const effectiveDatabaseName = resolveEffectiveMongoDatabaseName();
    const backendOrigin = getAtxfinanceBackendOrigin();

    let backendMongo: {
      checked: boolean;
      origin: string | null;
      skippedReason?: string;
      snapshot?: BackendMongoSnapshot;
      /** Exact string match on `host:port/database` label. */
      fingerprintMatch?: boolean;
      /** Same DB name from Spring health vs Next `resolveEffectiveMongoDatabaseName()`. */
      databaseNameMatch?: boolean;
      /** Next uses loopback and Spring uses Compose service `mongodb` (or the reverse) — same DB in typical local dev. */
      composeLoopbackVsServiceSkew?: boolean;
      /** Ops-friendly: strict match, Compose loopback vs `mongodb`, or same DB + both ping (prod host-string variants). */
      logicalMongoAlignment?: boolean;
      /** Why the UI considers Mongo “aligned” when strict fingerprint differs. */
      mongoAlignmentMode?: "strict" | "compose_skew" | "same_database";
    } = {
      checked: false,
      origin: backendOrigin ?? null
    };

    if (!backendOrigin) {
      backendMongo = {
        checked: false,
        origin: null,
        skippedReason: "ATXFINANCE_BACKEND_ORIGIN unset — BFF not configured; only Next (this service) Mongo is shown."
      };
    } else {
      const snapshot = await fetchBackendMongoSnapshot(backendOrigin);
      const fp = snapshot.fingerprint;
      const strictMatch =
        fp !== null && fp.length > 0 ? mongoFingerprintStrictEqual(fp, label) : undefined;
      const dbMatch =
        snapshot.database != null && snapshot.database.length > 0
          ? snapshot.database === effectiveDatabaseName
          : undefined;
      const skew =
        fp != null && fp.length > 0 ? isDockerComposeLoopbackVsServiceSkew(label, fp) : false;
      let mongoAlignmentMode: "strict" | "compose_skew" | "same_database" | undefined;
      if (strictMatch === true) {
        mongoAlignmentMode = "strict";
      } else if (Boolean(dbMatch) && snapshot.ok && skew) {
        mongoAlignmentMode = "compose_skew";
      } else if (Boolean(dbMatch) && snapshot.ok && fp != null && fp.length > 0) {
        /** Atlas / multi-host URIs: DB name matches and both sides reach Mongo; host:port label often still differs. */
        mongoAlignmentMode = "same_database";
      }
      const logical = mongoAlignmentMode !== undefined;
      backendMongo = {
        checked: true,
        origin: backendOrigin,
        snapshot,
        fingerprintMatch: strictMatch,
        databaseNameMatch: dbMatch,
        composeLoopbackVsServiceSkew: skew,
        logicalMongoAlignment: logical,
        mongoAlignmentMode
      };
    }

    await createAuditEvent({
      entityType: "system",
      entityId: "db-connection",
      action: "db_connection_viewed",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        label,
        nextEnv,
        effectiveDatabaseName,
        backendChecked: backendMongo.checked,
        backendFingerprintMatch: backendMongo.fingerprintMatch ?? null,
        backendLogicalMongoAlignment: backendMongo.logicalMongoAlignment ?? null,
        backendMongoAlignmentMode: backendMongo.mongoAlignmentMode ?? null
      }
    });

    return NextResponse.json({
      connectionLabel: label,
      /** Credential-safe; use instead of raw URI in UI. */
      connectionStringRedacted: redactMongoUriCredentials(uri),
      effectiveDatabaseName,
      nextEnv,
      atxfinanceBackendOrigin: backendOrigin ?? null,
      backendMongo,
      cliHint:
        "GCP: gcloud run services describe <next-service> --region REGION --project PROJECT --format='yaml(spec.template.spec.containers[0].env)' " +
        "and the same for atxfinance-backend-* — both should map MONGODB_URI from the same secret (e.g. MONGODB_URI_B64:latest)."
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve database connection information" },
      { status: 500 }
    );
  }
}
