import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadEquitySymbolsForTenant = vi.hoisted(() => vi.fn());
const countTenantPortfolios = vi.hoisted(() => vi.fn());
const fetchRawYahooQuotesWithCircuit = vi.hoisted(() => vi.fn());
const loadStockPositionsWithQty = vi.hoisted(() => vi.fn());
const quotesForSymbolsWithCircuit = vi.hoisted(() => vi.fn());
const tenantScopeFilter = vi.hoisted(() => vi.fn());
const buildMergedOptionScanTargets = vi.hoisted(() => vi.fn());
const executeOptionsExpirationRollJob = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn());

vi.mock("@/modules/scanner/phase3-scanner-shared", () => ({
  loadEquitySymbolsForTenant,
  countTenantPortfolios,
  fetchRawYahooQuotesWithCircuit,
  loadStockPositionsWithQty,
  quotesForSymbolsWithCircuit,
  tenantScopeFilter
}));

vi.mock("@/modules/strategy-options/options-strategy-scanner-job", () => ({
  buildMergedOptionScanTargets,
  executeOptionsExpirationRollJob
}));

vi.mock("@/lib/mongodb", () => ({
  getDb
}));

import {
    runCorporateEventsScanner,
    runIncomeCashFlowProjector,
    runOptionsExpirationRollManager,
    runRebalanceScanner,
    runRiskConcentrationScanner,
    runTaxLossHarvestScanner
} from "@/modules/scanner/phase3-scanner-jobs";

function task(category: Parameters<typeof runCorporateEventsScanner>[0]["category"]): {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string;
  category: typeof category;
  scheduleCron: string;
  enabled: boolean;
} {
  return {
    _id: new ObjectId(),
    tenantId: new ObjectId(),
    name: "phase3-test",
    category,
    scheduleCron: "0 9 * * *",
    enabled: true
  };
}

describe("phase3 scanner jobs (tenant-scoped summaries)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countTenantPortfolios.mockResolvedValue({ portfolioCount: 2, accountCount: 3 });
    tenantScopeFilter.mockImplementation((tid: ObjectId | undefined) => ({ tenantId: tid }));
    buildMergedOptionScanTargets.mockResolvedValue({ merged: [] });
    executeOptionsExpirationRollJob.mockResolvedValue({
      status: "success",
      output: "options_expiration_roll_manager: ok"
    });

    const toArray = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ toArray });
    const find = vi.fn().mockReturnValue({ limit });
    getDb.mockResolvedValue({
      collection: () => ({ find })
    } as never);
  });

  it("corporate_events_scanner: symbols=0 when tenant has no equity symbols", async () => {
    loadEquitySymbolsForTenant.mockResolvedValue([]);
    const t = task("corporate_events_scanner");
    const r = await runCorporateEventsScanner(t);
    expect(r.status).toBe("success");
    expect(r.output).toContain("corporate_events_scanner:");
    expect(r.output).toContain("symbols=0");
    expect(loadEquitySymbolsForTenant).toHaveBeenCalledWith(t.tenantId, 80);
  });

  it("corporate_events_scanner: aggregates quote flags when symbols exist", async () => {
    loadEquitySymbolsForTenant.mockResolvedValue(["TSLA"]);
    fetchRawYahooQuotesWithCircuit.mockResolvedValue({
      rows: [{ symbol: "TSLA", earningsTimestamp: Math.floor(Date.now() / 1000) + 86400 }],
      circuitOpen: false
    });
    const r = await runCorporateEventsScanner(task("corporate_events_scanner"));
    expect(r.status).toBe("success");
    expect(r.output).toContain("earnings_flags=");
    expect(fetchRawYahooQuotesWithCircuit).toHaveBeenCalled();
  });

  it("risk_concentration_scanner: positions=0 path", async () => {
    loadStockPositionsWithQty.mockResolvedValue([]);
    const r = await runRiskConcentrationScanner(task("risk_concentration_scanner"));
    expect(r.status).toBe("success");
    expect(r.output).toContain("risk_concentration_scanner:");
    expect(r.output).toContain("positions=0");
  });

  it("risk_concentration_scanner: computes hhi when mv available", async () => {
    loadStockPositionsWithQty.mockResolvedValue([
      { symbol: "A", qty: 10, avgCost: 10 } as never,
      { symbol: "B", qty: 10, avgCost: 10 } as never
    ]);
    quotesForSymbolsWithCircuit.mockResolvedValue({
      quoteBySymbol: new Map([
        ["A", 100],
        ["B", 100]
      ]),
      circuitOpen: false
    });
    const r = await runRiskConcentrationScanner(task("risk_concentration_scanner"));
    expect(r.status).toBe("success");
    expect(r.output).toContain("hhi=");
    expect(r.output).toContain("recon=");
  });

  it("rebalance: positions=0 path", async () => {
    loadStockPositionsWithQty.mockResolvedValue([]);
    const r = await runRebalanceScanner(task("rebalance"));
    expect(r.status).toBe("success");
    expect(r.output).toContain("rebalance_scanner:");
    expect(r.output).toContain("positions=0");
  });

  it("tax_loss_harvest_scanner: positions=0 path", async () => {
    loadStockPositionsWithQty.mockResolvedValue([]);
    const r = await runTaxLossHarvestScanner(task("tax_loss_harvest_scanner"));
    expect(r.status).toBe("success");
    expect(r.output).toContain("tax_loss_harvest_scanner:");
    expect(r.output).toContain("candidates=0");
  });

  it("income_cash_flow_projector: succeeds with empty option rows and merged targets", async () => {
    const t = task("income_cash_flow_projector");
    const r = await runIncomeCashFlowProjector(t);
    expect(r.status).toBe("success");
    expect(r.output).toContain("income_cash_flow_projector:");
    expect(r.output).toContain("short_legs=0");
    expect(buildMergedOptionScanTargets).toHaveBeenCalledWith({ tenantId: t.tenantId });
    expect(tenantScopeFilter).toHaveBeenCalledWith(t.tenantId);
  });

  it("options_expiration_roll_manager: forwards tenantId and bypass to shared job", async () => {
    const t = task("options_expiration_roll_manager");
    await runOptionsExpirationRollManager(t, { bypassMarketWindow: true });
    expect(executeOptionsExpirationRollJob).toHaveBeenCalledWith({
      tenantId: t.tenantId,
      bypassMarketWindow: true
    });
  });
});
