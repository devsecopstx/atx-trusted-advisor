import { createHash } from "node:crypto";

import { getRedisClientForPlane } from "@/lib/redis-client";
import type { XaiCollectionSearchSnippet } from "@/lib/xai";

const MEMORY_MAX = 200;
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
 * Short-TTL cache for xAI **lexical** collection search results (not embedding semantic cache).
 * **0** = disabled (default). When set, clamped 30–3600 seconds.
 */
export function getRagLexicalCacheTtlSeconds(): number {
  const raw = process.env.REDIS_RAG_LEXICAL_CACHE_TTL_SECONDS?.trim();
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 0;
  }
  const floored = Math.floor(n);
  if (floored <= 0) {
    return 0;
  }
  return Math.min(3600, Math.max(30, floored));
}

export function buildRagLexicalCacheKey(input: {
  collectionIds: string[];
  query: string;
  limit: number;
}): string {
  const normIds = [...input.collectionIds].map((s) => s.trim()).filter(Boolean).sort().join("\n");
  const normQ = input.query.trim().toLowerCase().slice(0, 4000);
  const payload = `${normIds}\n---\n${normQ}\n---\n${String(input.limit)}`;
  const h = createHash("sha256").update(payload).digest("hex").slice(0, 40);
  return `xf:rag:lexical:v1:${h}`;
}

function parseSnippets(raw: string): XaiCollectionSearchSnippet[] | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) {
      return null;
    }
    const out: XaiCollectionSearchSnippet[] = [];
    for (const row of v) {
      if (!row || typeof row !== "object") {
        return null;
      }
      const text = (row as { text?: unknown }).text;
      if (typeof text !== "string") {
        return null;
      }
      out.push({
        text,
        ...(typeof (row as { documentId?: unknown }).documentId === "string"
          ? { documentId: (row as { documentId: string }).documentId }
          : {}),
        ...(typeof (row as { documentName?: unknown }).documentName === "string"
          ? { documentName: (row as { documentName: string }).documentName }
          : {})
      });
    }
    return out;
  } catch {
    return null;
  }
}

export async function tryGetRagLexicalCache(key: string): Promise<XaiCollectionSearchSnippet[] | null> {
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }
      return parseSnippets(raw);
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
  return parseSnippets(e.value);
}

export async function setRagLexicalCache(
  key: string,
  snippets: XaiCollectionSearchSnippet[],
  ttlSeconds: number
): Promise<void> {
  if (ttlSeconds <= 0) {
    return;
  }
  const json = JSON.stringify(snippets);
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      await redis.set(key, json, { EX: ttlSeconds });
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
  memory.set(key, { value: json, expiresAt: Date.now() + ttlSeconds * 1000 });
}
