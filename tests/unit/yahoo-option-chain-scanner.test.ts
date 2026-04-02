import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCachedOptionChain: vi.fn(),
  setCachedOptionChain: vi.fn(),
  scannerCircuitAllow: vi.fn(),
  scannerCircuitRecordSuccess: vi.fn(),
  scannerCircuitRecordFailure: vi.fn(),
  fetchYahooOptionChainForExpiration: vi.fn()
}));

vi.mock("@/modules/scanner/scanner-option-chain-cache", () => ({
  getCachedOptionChain: mocks.getCachedOptionChain,
  setCachedOptionChain: mocks.setCachedOptionChain
}));

vi.mock("@/modules/scanner/scanner-circuit-breaker", () => ({
  scannerCircuitAllow: mocks.scannerCircuitAllow,
  scannerCircuitRecordSuccess: mocks.scannerCircuitRecordSuccess,
  scannerCircuitRecordFailure: mocks.scannerCircuitRecordFailure
}));

vi.mock("@/modules/strategy-options/options-chain", () => ({
  fetchYahooOptionChainForExpiration: mocks.fetchYahooOptionChainForExpiration
}));

import { fetchYahooOptionChainForScanner } from "@/modules/scanner/yahoo-option-chain-scanner";

describe("fetchYahooOptionChainForScanner", () => {
  const ctx = { tenantId: new ObjectId("507f1f77bcf86cd799439011") };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedOptionChain.mockResolvedValue(null);
    mocks.scannerCircuitAllow.mockResolvedValue({ allowed: true });
  });

  it("returns cached payload without calling Yahoo", async () => {
    mocks.getCachedOptionChain.mockResolvedValue({
      optionChain: [{ strike: 100, call: null, put: null }],
      actualExpiration: "2026-02-20"
    });

    const out = await fetchYahooOptionChainForScanner(ctx, "TSLA", "2026-02-20", 200, 30);

    expect(out?.actualExpiration).toBe("2026-02-20");
    expect(mocks.fetchYahooOptionChainForExpiration).not.toHaveBeenCalled();
    expect(mocks.scannerCircuitAllow).not.toHaveBeenCalled();
  });

  it("returns null when circuit is open", async () => {
    mocks.scannerCircuitAllow.mockResolvedValue({ allowed: false, reason: "circuit_open" });

    const out = await fetchYahooOptionChainForScanner(ctx, "TSLA", "2026-02-20", 200, 30);

    expect(out).toBeNull();
    expect(mocks.fetchYahooOptionChainForExpiration).not.toHaveBeenCalled();
  });

  it("caches non-empty Yahoo result", async () => {
    mocks.fetchYahooOptionChainForExpiration.mockResolvedValue({
      optionChain: [{ strike: 50, call: null, put: null }],
      actualExpiration: "2026-02-20"
    });

    const out = await fetchYahooOptionChainForScanner(ctx, "TSLA", "2026-02-20", 200, 30);

    expect(out?.optionChain).toHaveLength(1);
    expect(mocks.scannerCircuitRecordSuccess).toHaveBeenCalledWith(ctx.tenantId, "yahoo");
    expect(mocks.setCachedOptionChain).toHaveBeenCalled();
  });

  it("records failure on throw", async () => {
    mocks.fetchYahooOptionChainForExpiration.mockRejectedValue(new Error("upstream"));

    const out = await fetchYahooOptionChainForScanner(ctx, "TSLA", "2026-02-20", 200, 30);

    expect(out).toBeNull();
    expect(mocks.scannerCircuitRecordFailure).toHaveBeenCalledWith(ctx.tenantId, "yahoo");
  });
});
