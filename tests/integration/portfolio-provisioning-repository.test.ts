import { ObjectId, type Db } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { getDb } from "@/lib/mongodb";
import {
    ensureDefaultPortfolioInvariantForUser,
    getDefaultPortfolio,
    listPortfoliosForSessionUser,
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
  if (isPlainObject(expected) && "$type" in expected && (expected as { $type: unknown }).$type === "null") {
    return actual === null;
  }
  if (isPlainObject(expected) && "$in" in expected && Array.isArray((expected as { $in: unknown }).$in)) {
    const arr = (expected as { $in: unknown[] }).$in;
    return arr.some((v) => valueMatches(actual, v));
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
      countDocuments: async (filter: Record<string, unknown>) =>
        store.filter((doc) => docMatchesFilter(doc, filter)).length,
      findOne: async (filter: Record<string, unknown>) => {
        const found = store.find((doc) => docMatchesFilter(doc, filter));
        return (found as T | undefined) ?? null;
      },
      find: (filter: Record<string, unknown>) => {
        let sortKeys: Array<{ key: string; dir: 1 | -1 }> = [];
        return {
          sort(spec: Record<string, 1 | -1>) {
            sortKeys = Object.entries(spec).map(([key, dir]) => ({ key, dir }));
            return this;
          },
          async toArray(): Promise<T[]> {
            let rows = store.filter((doc) => docMatchesFilter(doc, filter)) as T[];
            if (sortKeys.length > 0) {
              rows = [...rows].sort((a, b) => {
                const ar = a as DocumentRecord;
                const br = b as DocumentRecord;
                for (const { key, dir } of sortKeys) {
                  const va = ar[key];
                  const vb = br[key];
                  let cmp = 0;
                  if (va instanceof Date && vb instanceof Date) {
                    cmp = va.getTime() - vb.getTime();
                  } else if (va instanceof ObjectId && vb instanceof ObjectId) {
                    cmp = va.toHexString().localeCompare(vb.toHexString());
                  } else {
                    cmp = String(va).localeCompare(String(vb));
                  }
                  if (cmp !== 0) {
                    return dir === 1 ? cmp : -cmp;
                  }
                }
                return 0;
              });
            }
            return rows;
          }
        };
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
    },
    seed(collectionName: string, doc: DocumentRecord) {
      ensureStore(collectionName).push(doc);
    }
  };
}

describe("portfolio provisioning repository", () => {
  const mockedGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getDefaultPortfolio matches when userId is stored as ObjectId (legacy)", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);
    const userId = "507f1f77bcf86cd799439011";
    const tenantId = "507f1f77bcf86cd799439022";
    fakeDb.seed("tenant_portfolio", {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      isDefault: true,
      tenantId: new ObjectId(tenantId),
      name: "Default Portfolio",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const found = await getDefaultPortfolio(userId, { tenantId });
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Default Portfolio");
  });

  it("getDefaultPortfolio matches default portfolio when tenantId is BSON null", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);
    const userId = "507f1f77bcf86cd799439011";
    const tenantId = "507f1f77bcf86cd799439022";
    fakeDb.seed("tenant_portfolio", {
      _id: new ObjectId(),
      userId,
      isDefault: true,
      tenantId: null,
      name: "Default Portfolio",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const found = await getDefaultPortfolio(userId, { tenantId });
    expect(found).not.toBeNull();
    expect(found?.userId).toBe(userId);
  });

  it("listPortfoliosForSessionUser returns all tenant-scoped portfolios for user", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);
    const userId = "507f1f77bcf86cd799439011";
    const tenantId = "507f1f77bcf86cd799439022";
    const tenantOid = new ObjectId(tenantId);
    const idA = new ObjectId();
    const idB = new ObjectId();
    fakeDb.seed("tenant_portfolio", {
      _id: idA,
      userId,
      isDefault: true,
      tenantId: tenantOid,
      name: "A",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      updatedAt: new Date("2020-01-01T00:00:00.000Z")
    });
    fakeDb.seed("tenant_portfolio", {
      _id: idB,
      userId,
      isDefault: false,
      tenantId: tenantOid,
      name: "B",
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-01T00:00:00.000Z")
    });

    const list = await listPortfoliosForSessionUser({ userId, tenantId });
    expect(list.length).toBe(2);
    expect(list.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("ensureDefaultPortfolioInvariantForUser clears duplicate isDefault and keeps oldest", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);
    const userId = "507f1f77bcf86cd799439011";
    const tenantId = "507f1f77bcf86cd799439022";
    const tenantOid = new ObjectId(tenantId);
    const older = new ObjectId();
    const newer = new ObjectId();
    const t0 = new Date("2020-01-01T00:00:00.000Z");
    const t1 = new Date("2021-01-01T00:00:00.000Z");
    fakeDb.seed("tenant_portfolio", {
      _id: older,
      userId,
      isDefault: true,
      tenantId: tenantOid,
      name: "First",
      createdAt: t0,
      updatedAt: t0
    });
    fakeDb.seed("tenant_portfolio", {
      _id: newer,
      userId,
      isDefault: true,
      tenantId: tenantOid,
      name: "Second",
      createdAt: t1,
      updatedAt: t1
    });

    const found = await ensureDefaultPortfolioInvariantForUser(userId, { tenantId });
    expect(found?._id?.toHexString()).toBe(older.toHexString());
    const after = await fakeDb.db
      .collection("tenant_portfolio")
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();
    expect(after.find((d) => d._id?.toHexString() === older.toHexString())?.isDefault).toBe(
      true
    );
    expect(after.find((d) => d._id?.toHexString() === newer.toHexString())?.isDefault).toBe(
      false
    );
  });

  it("ensureDefaultPortfolioInvariantForUser promotes oldest when none marked default", async () => {
    const fakeDb = buildFakeDb();
    mockedGetDb.mockResolvedValue(fakeDb.db);
    const userId = "507f1f77bcf86cd799439011";
    const tenantId = "507f1f77bcf86cd799439022";
    const tenantOid = new ObjectId(tenantId);
    const older = new ObjectId();
    const newer = new ObjectId();
    const t0 = new Date("2020-01-01T00:00:00.000Z");
    const t1 = new Date("2021-01-01T00:00:00.000Z");
    fakeDb.seed("tenant_portfolio", {
      _id: older,
      userId,
      isDefault: false,
      tenantId: tenantOid,
      name: "First",
      createdAt: t0,
      updatedAt: t0
    });
    fakeDb.seed("tenant_portfolio", {
      _id: newer,
      userId,
      isDefault: false,
      tenantId: tenantOid,
      name: "Second",
      createdAt: t1,
      updatedAt: t1
    });

    const found = await ensureDefaultPortfolioInvariantForUser(userId, { tenantId });
    expect(found?._id?.toHexString()).toBe(older.toHexString());
    expect(found?.isDefault).toBe(true);
    const after = await fakeDb.db
      .collection("tenant_portfolio")
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();
    expect(after.find((d) => d._id?.toHexString() === newer.toHexString())?.isDefault).toBe(
      false
    );
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
    expect(fakeDb.count("tenant_portfolio")).toBe(1);
    expect(fakeDb.count("portfolio_accounts")).toBe(1);
    expect(fakeDb.count("portfolio_watchlists")).toBe(1);
    expect(first.portfolio.ext_broker_ref).toBe("extBrokerName");
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
