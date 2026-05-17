import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backend-bff", () => ({
  shouldProxyPortfolioRequestsToBackend: vi.fn()
}));

import { shouldProxyPortfolioRequestsToBackend } from "@/lib/backend-bff";
import {
  isXchatSseProxyBackendEnabled,
  parseXchatStreamRequestMessage,
  shouldSkipXchatStreamBffForDeterministicDeskMessage,
  shouldSkipXchatStreamBffForWatchlistShowMessage
} from "@/lib/xchat-live-sse-policy";

describe("isXchatSseProxyBackendEnabled", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    delete process.env.XCHAT_SSE_PROXY_BACKEND;
    vi.mocked(shouldProxyPortfolioRequestsToBackend).mockReturnValue(true);
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.clearAllMocks();
  });

  it("delegates to the product BFF gate when SSE opt-out is unset", () => {
    expect(isXchatSseProxyBackendEnabled()).toBe(true);
    expect(shouldProxyPortfolioRequestsToBackend).toHaveBeenCalledTimes(1);
  });

  it("returns false when XCHAT_SSE_PROXY_BACKEND opts out", () => {
    for (const v of ["0", "false", "no", "off", "OFF"]) {
      process.env.XCHAT_SSE_PROXY_BACKEND = v;
      expect(isXchatSseProxyBackendEnabled()).toBe(false);
    }
    expect(shouldProxyPortfolioRequestsToBackend).not.toHaveBeenCalled();
  });

  it("returns false when the BFF gate is off even without opt-out", () => {
    vi.mocked(shouldProxyPortfolioRequestsToBackend).mockReturnValue(false);
    expect(isXchatSseProxyBackendEnabled()).toBe(false);
  });

  it("does not treat truthy SSE env as an extra enable (still uses gate)", () => {
    process.env.XCHAT_SSE_PROXY_BACKEND = "yes";
    vi.mocked(shouldProxyPortfolioRequestsToBackend).mockReturnValue(false);
    expect(isXchatSseProxyBackendEnabled()).toBe(false);
  });
});

describe("watchlist show stream BFF skip", () => {
  it("skips Spring proxy for show/how my watchlist messages", () => {
    expect(shouldSkipXchatStreamBffForWatchlistShowMessage("show my watchlist")).toBe(true);
    expect(shouldSkipXchatStreamBffForWatchlistShowMessage("how my watchlist")).toBe(true);
    expect(shouldSkipXchatStreamBffForWatchlistShowMessage("quote TSLA")).toBe(false);
  });

  it("skips Spring proxy for direct options_scan desk asks", () => {
    expect(
      shouldSkipXchatStreamBffForDeterministicDeskMessage("xoptions CSP ideas for ASTS with 7-14 DTE")
    ).toBe(true);
    expect(shouldSkipXchatStreamBffForDeterministicDeskMessage("quote TSLA")).toBe(false);
  });

  it("parses stream JSON body message", () => {
    expect(
      parseXchatStreamRequestMessage(JSON.stringify({ message: "show my watchlist", threadId: "t1" }))
    ).toBe("show my watchlist");
  });
});
