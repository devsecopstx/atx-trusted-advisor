import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as adviceEvents from "@/modules/compliance/advisor-advice-events";
import * as repo from "@/modules/core-admin/repository";
import * as notifications from "@/modules/notifications/portfolio-notification-service";
import {
    DEFAULT_MIN_ABS_MOVE_PERCENT,
    evaluateSignificantPriceMoves,
    persistPriceMoveAlerts,
    resolveMinMovePercent
} from "@/modules/watchlist/price-alert-service";

describe("evaluateSignificantPriceMoves", () => {
  it("returns empty when no prior lastPrice", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date() }],
      [{ symbol: "TSLA", lastPrice: 300 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("skips when prior lastPrice is zero", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 0 }],
      [{ symbol: "TSLA", lastPrice: 300 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("fires when move exceeds threshold (up)", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 106 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.symbol).toBe("TSLA");
    expect(r[0]?.newPrice).toBe(106);
    expect(r[0]?.changePct).toBeCloseTo(6, 5);
  });

  it("fires when move exceeds threshold (down)", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 94 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.changePct).toBeCloseTo(6, 5);
  });

  it("does not fire at exactly threshold (strict >)", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 105 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("respects custom min percent", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 102 }],
      1
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.changePct).toBeCloseTo(2, 5);
  });

  it("uses per-row priceAlertMinAbsMovePercent when stricter than default", () => {
    const r = evaluateSignificantPriceMoves(
      [
        {
          symbol: "TSLA",
          addedAt: new Date(),
          lastPrice: 100,
          priceAlertMinAbsMovePercent: 10
        }
      ],
      [{ symbol: "TSLA", lastPrice: 106 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("fires per-row when looser than default", () => {
    const r = evaluateSignificantPriceMoves(
      [
        {
          symbol: "TSLA",
          addedAt: new Date(),
          lastPrice: 100,
          priceAlertMinAbsMovePercent: 2
        }
      ],
      [{ symbol: "TSLA", lastPrice: 103 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.changePct).toBeCloseTo(3, 5);
  });

  it("uses symbolRowIndex so duplicate tickers compare against the correct prior lastPrice", () => {
    const d = new Date();
    const rows = [
      { symbol: "TSLA", addedAt: d, lastPrice: 100 },
      { symbol: "TSLA", addedAt: d, lastPrice: 200 }
    ];
    const r = evaluateSignificantPriceMoves(
      rows,
      [
        { symbol: "TSLA", lastPrice: 106, symbolRowIndex: 0 },
        { symbol: "TSLA", lastPrice: 188, symbolRowIndex: 1 }
      ],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(2);
    const byNew = new Map(r.map((x) => [x.newPrice, x.changePct] as const));
    expect(byNew.get(106)).toBeCloseTo(6, 5);
    expect(byNew.get(188)).toBeCloseTo(6, 5);
  });

  it("does not fire when symbolsBefore rows are legacy strings (no prior lastPrice)", () => {
    const rows = ["TSLA", "TSLA"];
    const r = evaluateSignificantPriceMoves(
      rows,
      [
        { symbol: "TSLA", lastPrice: 106, symbolRowIndex: 0 },
        { symbol: "TSLA", lastPrice: 188, symbolRowIndex: 1 }
      ],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("uses symbolRowIndex with mixed structured row and legacy string", () => {
    const d = new Date();
    const rows = [{ symbol: "TSLA", addedAt: d, lastPrice: 100 }, "TSLA"];
    const r = evaluateSignificantPriceMoves(
      rows,
      [{ symbol: "TSLA", lastPrice: 106, symbolRowIndex: 0 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.newPrice).toBe(106);
  });
});

describe("resolveMinMovePercent", () => {
  it("falls back to default when row omits override", () => {
    expect(resolveMinMovePercent(undefined, 5)).toBe(5);
    expect(resolveMinMovePercent({ symbol: "A", addedAt: new Date() }, 7)).toBe(7);
  });

  it("clamps override into range", () => {
    expect(
      resolveMinMovePercent(
        { symbol: "A", addedAt: new Date(), priceAlertMinAbsMovePercent: 0.01 },
        5
      )
    ).toBe(0.1);
    expect(
      resolveMinMovePercent(
        { symbol: "A", addedAt: new Date(), priceAlertMinAbsMovePercent: 200 },
        5
      )
    ).toBe(100);
  });
});

describe("persistPriceMoveAlerts", () => {
  const portfolioId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.spyOn(adviceEvents, "resolvePortfolioOwnerForAdviceArchive").mockResolvedValue(null);
    vi.spyOn(adviceEvents, "fireAndForgetArchiveAdvisorSystemAdvice").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips create when recent alert exists (cooldown)", async () => {
    vi.spyOn(repo, "adminHasRecentPriceAlertForSymbol").mockResolvedValue(true);
    const create = vi.spyOn(repo, "adminCreatePortfolioAlert").mockResolvedValue(null);
    const desk = vi
      .spyOn(notifications, "dispatchPortfolioDeskEvents")
      .mockResolvedValue({
        slack: { targets: 0, postsOk: 0 },
        email: { targets: 0, sent: 0, skipped: 0, failed: 0 },
        sms: { targets: 0, skipped: 0 },
        push: { targets: 0, skipped: 0 }
      });

    const r = await persistPriceMoveAlerts(
      portfolioId,
      [{ symbol: "TSLA", newPrice: 100, changePct: 6 }],
      { cooldownMs: 60 * 60 * 1000 }
    );

    expect(r.created).toBe(0);
    expect(r.skippedCooldown).toBe(1);
    expect(r.recorded).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
    expect(desk).not.toHaveBeenCalled();
  });

  it("creates alert when no recent row (cooldown)", async () => {
    vi.spyOn(repo, "adminHasRecentPriceAlertForSymbol").mockResolvedValue(false);
    vi.spyOn(repo, "adminCreatePortfolioAlert").mockResolvedValue({
      _id: undefined,
      title: "TSLA price alert",
      severity: "info",
      status: "active",
      userId: "u",
      portfolioId: {} as import("mongodb").ObjectId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const desk = vi
      .spyOn(notifications, "dispatchPortfolioDeskEvents")
      .mockResolvedValue({
        slack: { targets: 0, postsOk: 0 },
        email: { targets: 0, sent: 0, skipped: 0, failed: 0 },
        sms: { targets: 0, skipped: 0 },
        push: { targets: 0, skipped: 0 }
      });

    const r = await persistPriceMoveAlerts(
      portfolioId,
      [{ symbol: "TSLA", newPrice: 100, changePct: 6 }],
      { cooldownMs: 60 * 60 * 1000 }
    );

    expect(r.created).toBe(1);
    expect(r.skippedCooldown).toBe(0);
    expect(desk).toHaveBeenCalled();
  });

  it("bypasses cooldown when cooldownMs is 0", async () => {
    const recent = vi.spyOn(repo, "adminHasRecentPriceAlertForSymbol").mockResolvedValue(true);
    vi.spyOn(repo, "adminCreatePortfolioAlert").mockResolvedValue({
      _id: undefined,
      title: "TSLA price alert",
      severity: "info",
      status: "active",
      userId: "u",
      portfolioId: {} as import("mongodb").ObjectId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    vi.spyOn(notifications, "dispatchPortfolioDeskEvents").mockResolvedValue({
      slack: { targets: 0, postsOk: 0 },
      email: { targets: 0, sent: 0, skipped: 0, failed: 0 },
      sms: { targets: 0, skipped: 0 },
      push: { targets: 0, skipped: 0 }
    });

    const r = await persistPriceMoveAlerts(
      portfolioId,
      [{ symbol: "TSLA", newPrice: 100, changePct: 6 }],
      { cooldownMs: 0 }
    );

    expect(r.created).toBe(1);
    expect(r.skippedCooldown).toBe(0);
    expect(recent).not.toHaveBeenCalled();
  });
});
