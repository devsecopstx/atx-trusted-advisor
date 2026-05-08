/**
 * Shared macro index quotes for workspace pulse / headers — **not** user watchlist rows.
 * Persists short-lived rows so concurrent sessions reuse one Yahoo batch outcome.
 */

import { getDb } from "@/lib/mongodb";
import { LOOKUP_ROUTE, lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export const SYSTEM_INDEX_CACHE_COLLECTION = "system_index_cache";

/** Quotes fresher than this are served from Mongo instead of hitting Yahoo again. */
const DEFAULT_CACHE_MAX_AGE_MS = 45_000;

type SystemIndexCacheDoc = {
  yahooKey: string;
  displaySymbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  updatedAt: Date;
};

let indexesEnsured = false;

async function ensureSystemIndexCacheIndexes(): Promise<void> {
  if (indexesEnsured) {
    return;
  }
  indexesEnsured = true;
  const db = await getDb();
  try {
    await db.collection(SYSTEM_INDEX_CACHE_COLLECTION).createIndex({ yahooKey: 1 }, { unique: true });
    await db.collection(SYSTEM_INDEX_CACHE_COLLECTION).createIndex({ updatedAt: 1 }, { expireAfterSeconds: 3600 });
  } catch {
    /* non-fatal — TTL/index may already exist */
  }
}

function docToLookup(doc: SystemIndexCacheDoc): SymbolLookupResult {
  return {
    symbol: doc.yahooKey,
    price: doc.price,
    change: doc.change,
    changePercent: doc.changePercent,
    source: LOOKUP_ROUTE
  };
}

export type MacroIndexDef = { yahoo: string; symbol: string };

/**
 * Resolve Yahoo quotes for macro indices: Mongo cache (fresh) + `lookupSymbols` for misses, then upsert cache.
 */
export async function resolveMacroQuotesWithSystemCache(
  defs: ReadonlyArray<MacroIndexDef>,
  maxAgeMs: number = DEFAULT_CACHE_MAX_AGE_MS
): Promise<Map<string, SymbolLookupResult>> {
  await ensureSystemIndexCacheIndexes();
  const db = await getDb();
  const coll = db.collection<SystemIndexCacheDoc>(SYSTEM_INDEX_CACHE_COLLECTION);

  const normalized = defs.map((d) => ({
    yahooKey: d.yahoo.trim().toUpperCase(),
    displaySymbol: d.symbol.trim().toUpperCase()
  }));

  const yahooKeys = [...new Set(normalized.map((n) => n.yahooKey))];
  const displayByYahoo = new Map(normalized.map((n) => [n.yahooKey, n.displaySymbol]));

  const cutoff = new Date(Date.now() - maxAgeMs);
  const cachedDocs = await coll
    .find({
      yahooKey: { $in: yahooKeys },
      updatedAt: { $gte: cutoff }
    })
    .toArray();

  const result = new Map<string, SymbolLookupResult>();
  const freshKeys = new Set<string>();
  for (const doc of cachedDocs) {
    const key = doc.yahooKey.toUpperCase();
    freshKeys.add(key);
    result.set(key, docToLookup(doc));
  }

  const staleKeys = yahooKeys.filter((k) => !freshKeys.has(k));
  if (staleKeys.length > 0) {
    const live = await lookupSymbols(staleKeys);
    for (const key of staleKeys) {
      const row = live.get(key);
      if (row) {
        result.set(key, row);
      }
    }

    const now = new Date();
    const ops = staleKeys
      .map((yahooKey) => {
        const row = live.get(yahooKey);
        if (!row) {
          return null;
        }
        const displaySymbol = displayByYahoo.get(yahooKey) ?? yahooKey;
        return {
          updateOne: {
            filter: { yahooKey },
            update: {
              $set: {
                yahooKey,
                displaySymbol,
                price: row.price,
                change: row.change,
                changePercent: row.changePercent,
                updatedAt: now
              }
            },
            upsert: true
          }
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (ops.length > 0) {
      try {
        await coll.bulkWrite(ops, { ordered: false });
      } catch {
        /* ignore bulk races */
      }
    }
  }

  return result;
}
