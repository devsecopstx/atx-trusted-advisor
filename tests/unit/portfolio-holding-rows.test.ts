import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { buildPortfolioHoldingRows } from "@/lib/portfolio-holding-rows";
import type { Account, Position } from "@/modules/core-admin/types";

describe("buildPortfolioHoldingRows", () => {
  it("maps positions with account names and book values", () => {
    const aid = new ObjectId();
    const pid = new ObjectId();
    const now = new Date();
    const accounts: Account[] = [
      {
        _id: aid,
        userId: "u1",
        portfolioId: pid,
        name: "IRA",
        type: "fidelity",
        extAccountId: "x",
        cashBalance: 0,
        isDefault: true,
        createdAt: now,
        updatedAt: now
      }
    ];
    const positions: Position[] = [
      {
        userId: "u1",
        portfolioId: pid,
        accountId: aid,
        symbol: "TSLA",
        qty: 2,
        avgCost: 100,
        type: "stock",
        createdAt: now,
        updatedAt: now
      } as Position
    ];
    const rows = buildPortfolioHoldingRows(accounts, positions);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountName).toBe("IRA");
    expect(rows[0].bookUsd).toBe(200);
    expect(rows[0].positionType).toBe("stock");
  });
});
