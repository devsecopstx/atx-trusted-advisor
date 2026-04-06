#!/usr/bin/env node
/**
 * One-shot migration: merge per-portfolio `portfolio_watchlists` rows into one user-global doc
 * per (tenantId, userId), then drop legacy indexes (optional with --apply).
 *
 * Usage:
 *   node scripts/ops/merge-user-watchlists.mjs           # dry-run (default)
 *   node scripts/ops/merge-user-watchlists.mjs --apply   # merge + delete extras + recreate indexes
 *
 * Requires MONGODB_URI (or same env as other ops scripts). Run **before** or **after** deploy:
 * if DB still has duplicates, `uniq_watchlist_per_user` createIndex will fail until this completes.
 */
import { MongoClient, ObjectId } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "../lib/resolve-mongo-uri.mjs";

const DB_NAME = resolveSeedDbName();
const COLL = "portfolio_watchlists";
const TENANT_PORTFOLIO = "tenant_portfolio";

function normalizeUserKey(raw) {
  if (raw == null) {
    return "";
  }
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (raw instanceof ObjectId) {
    return raw.toHexString();
  }
  if (typeof raw === "object" && typeof raw.toHexString === "function") {
    return raw.toHexString();
  }
  return String(raw);
}

function tenantKey(tenantId) {
  if (!tenantId) {
    return "__no_tenant__";
  }
  if (tenantId instanceof ObjectId) {
    return tenantId.toHexString();
  }
  return String(tenantId);
}

function mergeSymbols(rows) {
  const map = new Map();
  for (const doc of rows) {
    const arr = Array.isArray(doc.symbols) ? doc.symbols : [];
    for (const item of arr) {
      const sym = (item?.symbol ?? "").trim().toUpperCase();
      if (!sym) {
        continue;
      }
      const prev = map.get(sym);
      if (!prev) {
        map.set(sym, { ...item, symbol: sym });
      } else {
        map.set(sym, { ...prev, ...item, symbol: sym });
      }
    }
  }
  return Array.from(map.values());
}

function pickCanonicalDoc(docs, defaultPortfolioId) {
  if (docs.length === 1) {
    return docs[0];
  }
  const withDefault = defaultPortfolioId
    ? docs.find((d) => d.portfolioId && d.portfolioId.equals(defaultPortfolioId))
    : null;
  if (withDefault) {
    return withDefault;
  }
  return [...docs].sort((a, b) => {
    const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
    const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
    return tb - ta;
  })[0];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const uri = resolveMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);
  const coll = db.collection(COLL);

  try {
    const all = await coll.find({}).toArray();
    const groups = new Map();

    for (const doc of all) {
      const uid = normalizeUserKey(doc.userId);
      if (!uid) {
        continue;
      }
      const tk = tenantKey(doc.tenantId);
      const gk = `${tk}::${uid}`;
      const list = groups.get(gk) ?? [];
      list.push(doc);
      groups.set(gk, list);
    }

    let mergeGroups = 0;
    let deleteExtra = 0;
    let singleDocUpdates = 0;

    for (const [, docs] of groups) {
      if (docs.length <= 1) {
        continue;
      }
      mergeGroups += 1;
      const tenantId = docs[0].tenantId;
      const uidHex = normalizeUserKey(docs[0].userId);

      let defaultPf = null;
      if (tenantId instanceof ObjectId && ObjectId.isValid(uidHex)) {
        defaultPf = await db.collection(TENANT_PORTFOLIO).findOne({
          tenantId,
          userId: new ObjectId(uidHex),
          isDefault: true
        });
        if (!defaultPf) {
          defaultPf = await db.collection(TENANT_PORTFOLIO).findOne({
            tenantId,
            userId: uidHex,
            isDefault: true
          });
        }
      }

      const canonical = pickCanonicalDoc(docs, defaultPf?._id);
      const mergedSymbols = mergeSymbols(docs);
      const others = docs.filter((d) => d._id.toHexString() !== canonical._id.toHexString());

      console.log(
        JSON.stringify({
          action: "merge",
          userId: uidHex,
          tenantId: tenantId instanceof ObjectId ? tenantId.toHexString() : null,
          keepId: canonical._id.toHexString(),
          removeIds: others.map((o) => o._id.toHexString()),
          symbolCount: mergedSymbols.length
        })
      );

      if (apply) {
        await coll.updateOne(
          { _id: canonical._id },
          {
            $set: {
              symbols: mergedSymbols,
              updatedAt: new Date(),
              isDefault: true
            },
            $unset: { portfolioId: "" }
          }
        );
        for (const o of others) {
          await coll.deleteOne({ _id: o._id });
          deleteExtra += 1;
        }
      }
    }

    const singles = [...groups.values()].filter((d) => d.length === 1).map((d) => d[0]);
    for (const doc of singles) {
      if (doc.portfolioId) {
        singleDocUpdates += 1;
        console.log(
          JSON.stringify({
            action: "unset_portfolioId",
            id: doc._id.toHexString(),
            userId: normalizeUserKey(doc.userId)
          })
        );
        if (apply) {
          await coll.updateOne({ _id: doc._id }, { $unset: { portfolioId: "" } });
        }
      }
    }

    if (apply) {
      const wl = coll;
      try {
        await wl.dropIndex("uniq_watchlist_per_portfolio");
      } catch {
        /* noop */
      }
      try {
        await wl.dropIndex("idx_watchlists_snapshot_portfolio_user");
      } catch {
        /* noop */
      }
      await wl.createIndex(
        { tenantId: 1, userId: 1 },
        { unique: true, name: "uniq_watchlist_per_user" }
      );
      await wl.createIndex({ userId: 1, tenantId: 1 }, { name: "idx_watchlists_user_tenant" });
    }

    console.log(
      JSON.stringify({
        dryRun: !apply,
        totalDocs: all.length,
        mergeGroups,
        deleteExtra: apply ? deleteExtra : mergeGroups > 0 ? "(pending)" : 0,
        singleDocPortfolioUnset: singleDocUpdates
      })
    );
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
