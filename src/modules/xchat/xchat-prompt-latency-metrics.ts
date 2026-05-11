import type { Db } from "mongodb";

import type { AdminOpsXchatPromptLatencyRow } from "@/lib/admin-ops-summary-contract";
import { getDb } from "@/lib/mongodb";

export const XCHAT_PROMPT_LATENCY_COLLECTION = "xchat_prompt_latency_samples";

let ensureIndexesPromise: Promise<void> | null = null;

export function isXchatPromptLatencyMetricsEnabled(): boolean {
  const v = process.env.XCHAT_PROMPT_LATENCY_METRICS_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function ensureXchatPromptLatencyIndexes(db: Db): Promise<void> {
  await db.collection(XCHAT_PROMPT_LATENCY_COLLECTION).createIndexes([
    {
      key: { createdAt: 1 },
      name: "ttl_xchat_prompt_latency_created",
      expireAfterSeconds: 7 * 24 * 60 * 60
    },
    {
      key: { tenantId: 1, createdAt: -1 },
      name: "xchat_prompt_latency_tenant_created"
    },
    {
      key: { promptType: 1, createdAt: -1 },
      name: "xchat_prompt_latency_type_created"
    }
  ]);
}

function scheduleEnsureIndexes(): void {
  if (ensureIndexesPromise) {
    return;
  }
  ensureIndexesPromise = (async () => {
    const db = await getDb();
    await ensureXchatPromptLatencyIndexes(db);
  })().catch(() => {
    ensureIndexesPromise = null;
  });
}

export async function recordXchatPromptLatencySample(input: {
  tenantId: string;
  promptType: string;
  durationMs: number;
}): Promise<void> {
  if (!isXchatPromptLatencyMetricsEnabled()) {
    return;
  }
  const tid = input.tenantId.trim();
  if (!tid) {
    return;
  }
  const ms = Math.round(input.durationMs);
  if (!Number.isFinite(ms) || ms < 0 || ms > 600_000) {
    return;
  }
  const pt = input.promptType.trim().slice(0, 64) || "unknown";
  scheduleEnsureIndexes();
  try {
    const db = await getDb();
    await db.collection(XCHAT_PROMPT_LATENCY_COLLECTION).insertOne({
      tenantId: tid,
      promptType: pt,
      durationMs: ms,
      createdAt: new Date()
    });
  } catch {
    /* sampling must not affect ask */
  }
}

function percentileNearestRank(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) {
    return null;
  }
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1;
  const idx = Math.max(0, Math.min(rank, sortedAsc.length - 1));
  return sortedAsc[idx] ?? null;
}

/** Rolling ~24h window; capped read for ops dashboard (recent samples dominate). */
export async function aggregateXchatPromptLatencySummariesLast24h(
  db: Db,
  input: { platformWide: boolean; tenantHex?: string }
): Promise<AdminOpsXchatPromptLatencyRow[]> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = { createdAt: { $gte: since } };
  if (!input.platformWide && input.tenantHex?.trim()) {
    match.tenantId = input.tenantHex.trim();
  }

  const docs = await db
    .collection(XCHAT_PROMPT_LATENCY_COLLECTION)
    .find(match)
    .sort({ createdAt: -1 })
    .project({ promptType: 1, durationMs: 1 })
    .limit(12_000)
    .toArray();

  const byType = new Map<string, number[]>();
  for (const d of docs) {
    const t = typeof d.promptType === "string" ? d.promptType : "unknown";
    const raw = d.durationMs;
    const ms = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    if (ms === null) {
      continue;
    }
    const arr = byType.get(t) ?? [];
    arr.push(ms);
    byType.set(t, arr);
  }

  const rows: AdminOpsXchatPromptLatencyRow[] = [];
  for (const [promptType, arr] of byType) {
    arr.sort((a, b) => a - b);
    const p50 = percentileNearestRank(arr, 50);
    const p95 = percentileNearestRank(arr, 95);
    if (p50 !== null && p95 !== null) {
      rows.push({
        promptType,
        sampleCount: arr.length,
        p50Ms: Math.round(p50),
        p95Ms: Math.round(p95)
      });
    }
  }
  rows.sort((a, b) => a.promptType.localeCompare(b.promptType));
  return rows;
}
