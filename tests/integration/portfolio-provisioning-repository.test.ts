import { ObjectId, type Db } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { getDb } from "@/lib/mongodb";
import {
  provisionDefaultPortfolioForUser,
  upsertPositionForAccount
} from "@/modules/core-admin/repository";

type DocumentRecord = Record<string, unknown> & { _id?: ObjectId };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueMatches(actual: unknown, expected: unknown): boolean {
  if (expected instanceof ObjectId) {
    return actual instanceof ObjectId && actual.equals(expected);
  }
  if (isPlainObject(expected) && "$exists" in expected) {
    const existsValue = expected.$exists;
    if (typeof existsValue !== "boolean") {
      return false;
    }
    return existsValue ? actual !== undefined : actual === undefined;
  }
  return actual === expected;
}

function docMatchesFilter(doc: DocumentRecord, filter: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === "$or") {
      if (!Array.isArray(expected)) {
        return false;
      }
      const didMatch = expected.some((branch) =>
        isPlainObject(branch) ? docMatchesFilter(doc, branch) : false
      );
      if (!didMatch) {
        return false;
      }
      continue;
    }
    const actual = doc[key];
    if (!valueMatches(actual, expected)) {
      return false;
    }
  }
  return true;
}

function buildFakeDb() {
  const stores = new Map<string, DocumentRecord[]>();

  function ensureStore(name: string): DocumentRecord[] {
    const existing = stores.get(name);
    if (existing) {
      return existing;
    }
    const next: DocumentRecord[] = [];
    stores.set(name, next);
    return next;
  }

  function collection<T extends DocumentRecord>(name: string) {
    const store = ensureStore(name);

    return {
      createIndex: async () => `${name}_idx`,
      findOne: async (filter: Record<string, unknown>) => {
        const found = store.find((doc) => docMatchesFilter(doc, filter));
        return (found as T | undefined) ?? null;
      },
      updateOne: async (
        filter: Record<string, unknown>,
        update: {
          $setOnInsert?: Record<string, unknown>;
          $set?: Record<string, unknown>;
        },
        options?: { upsert?: boolean }
      ) => {
        const found = store.find((doc) => docMatchesFilter(doc, filter));
        if (found) {
          if (update.$set) {
            Object.assign(found, update.$set);
          }
          return { matchedCount: 1, modifiedCount: 1, upsertedId: null };
        }
        if (!options?.upsert) {
          return { matchedCount: 0, modifiedCount: 0, upsertedId: null };
        }

        const created: DocumentRecord = {
          _id: new ObjectId()
        };
        if (update.$setOnInsert) {
          Object.assign(created, update.$setOnInsert);
        }
        if (update.$set) {
          Object.assign(created, update.$set);
        }
        for (const [key, value] of Object.entries(filter)) {
          if (key === "$or") {
            continue;
          }
          if (!(key in created) && !isPlainObject(value)) {
            created[key] = value;
          }
        }
        store.push(created);
        return { matchedCount: 0, modifiedCount: 0, upsertedId: created._id };
      },
      updateMany: async (
        filter: Record<string, unknown>,
        update: { $set?: Record<string, unknown> }
      ) => {
        let modified = 0;
        for (const doc of store) {
          if (!docMatchesFilter(doc, filter)) {
            continue;
          }
          if (update.$set) {
            Object.assign(doc, update.$set);
            modified += 1;
          }
        }
        return { matchedCount: modified, modifiedCount: modified };
      }
    };
  }

  return {
    db: {
      collection
    } as unknown as Db,
    count(collectionName: string): number {
      return ensureStore(collectionName).length;
    }
  };
}

describe("portfolio provisioning repository", () => {
  const mockedGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provisions defaults idempotently and keeps one watchlist per portfolio", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);

    const first = await provisionDefaultPortfolioForUser({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });
    const second = await provisionDefaultPortfolioForUser({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });

    expect(first.portfolio._id?.toHexString()).toBe(second.portfolio._id?.toHexString());
    expect(first.account._id?.toHexString()).toBe(second.account._id?.toHexString());
    expect(first.watchlist._id?.toHexString()).toBe(second.watchlist._id?.toHexString());
    expect(fakeDb.count("portfolio_portfolios")).toBe(1);
    expect(fakeDb.count("portfolio_accounts")).toBe(1);
    expect(fakeDb.count("portfolio_watchlists")).toBe(1);
  });

  it("rejects position writes when account does not belong to portfolio", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);

    const provisioned = await provisionDefaultPortfolioForUser({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });

    await expect(
      upsertPositionForAccount({
        userId: "507f1f77bcf86cd799439011",
        tenantId: "507f1f77bcf86cd799439022",
        portfolioId: new ObjectId().toHexString(),
        accountId: provisioned.account._id!.toHexString(),
        symbol: "AAPL",
        qty: 10,
        avgCost: 150
      })
    ).rejects.toMatchObject({
      code: "ACCOUNT_PORTFOLIO_MISMATCH"
    });
  });
});
