import { createHash } from "node:crypto";

import { getRedisClientForPlane } from "@/lib/redis-client";

import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

import { normalizePositionType } from "@/modules/core-admin/types";
import { collectIncomeIdeasEquitySymbols } from "@/modules/xchat/income-ideas-prompt";

const MEMORY_MAX = 120;
const memory = new Map<string, { expiresAt: number; value: string }>();

function evictMemoryExpired(): void {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) {
      memory.delete(k);
    }
  }
}

/**
 * TTL seconds for cached **final** income-ideas assistant text (markdown report). Clamped 300–1800; default 1200 (~20m).
 * Invalidates naturally when `workspaceContentRev` or book/watchlist signatures change.
 */
export function getIncomeIdeasResponseCacheTtlSeconds(): number {
  const raw = process.env.REDIS_INCOME_IDEAS_RESPONSE_CACHE_TTL_SECONDS?.trim();
  if (!raw) {
    return 1200;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 1200;
  }
  return Math.min(1800, Math.max(300, Math.floor(n)));
}

export function buildPositionsSignatureForIncomeIdeasCache(preload: WorkspaceSnapshotPreload): string {
  const rows = preload.positionsFull
    .filter((r) => normalizePositionType(r.positionType) === "stock")
    .map((r) => ({
      s: r.symbol.trim().toUpperCase(),
      q: r.qty,
      a: r.avgCost
    }))
    .sort((x, y) => x.s.localeCompare(y.s));
  return JSON.stringify(rows);
}

export function buildWatchlistSignatureForIncomeIdeasCache(preload: WorkspaceSnapshotPreload): string {
  const wl = preload.promptJson.watchlist;
  if ("error" in wl) {
    return "none";
  }
  const syms = wl.symbols
    .map((s) => ({
      t: String(s.symbol).trim().toUpperCase(),
      lt: typeof s.lineType === "string" ? s.lineType : "",
      st: typeof s.strategy === "string" ? s.strategy : ""
    }))
    .sort((a, b) => a.t.localeCompare(b.t));
  return JSON.stringify(syms);
}

export function buildIncomeIdeasResponseCacheKey(input: {
  tenantIdHex: string;
  userIdHex: string;
  preload: WorkspaceSnapshotPreload;
  personaIdHex: string;
  executionModel: string;
}): string {
  const rev = input.preload.promptJson.workspaceContentRev;
  const portfolioId = input.preload.promptJson.portfolio.id;
  const posSig = buildPositionsSignatureForIncomeIdeasCache(input.preload);
  const wlSig = buildWatchlistSignatureForIncomeIdeasCache(input.preload);
  const quoteSig = collectIncomeIdeasEquitySymbols(input.preload, 40).join(",");
  const payload = [
    input.tenantIdHex,
    input.userIdHex,
    portfolioId,
    String(rev),
    posSig,
    wlSig,
    quoteSig,
    input.personaIdHex,
    input.executionModel.trim(),
    "income_ideas_compact_v1"
  ].join("\n---\n");
  const h = createHash("sha256").update(payload).digest("hex").slice(0, 40);
  return `xf:xchat:income_ideas_resp:v1:${h}`;
}

export async function tryGetIncomeIdeasResponseCache(key: string): Promise<string | null> {
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      const raw = await redis.get(key);
      return typeof raw === "string" && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }
  evictMemoryExpired();
  const e = memory.get(key);
  if (!e || Date.now() >= e.expiresAt) {
    if (e) {
      memory.delete(key);
    }
    return null;
  }
  return e.value;
}

export async function setIncomeIdeasResponseCache(
  key: string,
  assistantRawText: string,
  ttlSeconds: number = getIncomeIdeasResponseCacheTtlSeconds()
): Promise<void> {
  if (ttlSeconds <= 0 || assistantRawText.trim().length === 0) {
    return;
  }
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      await redis.set(key, assistantRawText, { EX: ttlSeconds });
    } catch {
      /* ignore */
    }
    return;
  }
  evictMemoryExpired();
  if (memory.size >= MEMORY_MAX) {
    const first = memory.keys().next().value as string | undefined;
    if (first) {
      memory.delete(first);
    }
  }
  memory.set(key, { value: assistantRawText, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Test helper. */
export function __resetIncomeIdeasResponseCacheForTest(): void {
  memory.clear();
}
