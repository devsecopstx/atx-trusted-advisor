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
import { createAuditEvent } from "@/modules/audit/repository";

const BACKEND_HEALTH_TIMEOUT_MS = 6000;

type BackendMongoSnapshot = {
  ok: boolean;
  fingerprint: string | null;
  mongoStatus?: string;
  env?: {
    MONGODB_URI_present?: boolean;
    MONGODB_URI_B64_present?: boolean;
    SPRING_DATA_MONGODB_URI_present?: boolean;
  };
  error?: string;
};

function normalizeFingerprint(s: string): string {
  return s.trim().toLowerCase().replace(/\/+$/, "");
}

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
      fingerprintMatch?: boolean;
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
      const match =
        snapshot.fingerprint !== null
          ? normalizeFingerprint(snapshot.fingerprint) === normalizeFingerprint(label)
          : undefined;
      backendMongo = {
        checked: true,
        origin: backendOrigin,
        snapshot,
        fingerprintMatch: match
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
        backendFingerprintMatch: backendMongo.fingerprintMatch ?? null
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
