import { describe, expect, it, vi } from "vitest";

import {
    buildIbkrPortfolioAccountsUrl,
    parseIbkrPortfolioAccountsJson
} from "@/modules/ibkr-integration/client-portfolio";

describe("buildIbkrPortfolioAccountsUrl", () => {
  it("appends v1/api/portfolio/accounts without double slash", () => {
    expect(buildIbkrPortfolioAccountsUrl("https://localhost:5000")).toBe(
      "https://localhost:5000/v1/api/portfolio/accounts"
    );
    expect(buildIbkrPortfolioAccountsUrl("https://localhost:5000/")).toBe(
      "https://localhost:5000/v1/api/portfolio/accounts"
    );
  });
});

describe("parseIbkrPortfolioAccountsJson", () => {
  it("maps IBKR-style rows to stable account summaries", () => {
    const parsed = parseIbkrPortfolioAccountsJson([
      {
        id: "U111",
        accountId: "U111",
        accountTitle: "Individual",
        displayName: "U111",
        currency: "USD"
      },
      { accountId: "U222", displayName: "Paper" }
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.accounts).toHaveLength(2);
    expect(parsed.accounts[0]?.id).toBe("U111");
    expect(parsed.accounts[0]?.displayLabel).toBe("U111");
    expect(parsed.accounts[1]?.id).toBe("U222");
  });

  it("rejects non-array", () => {
    const parsed = parseIbkrPortfolioAccountsJson({ foo: 1 });
    expect(parsed.ok).toBe(false);
  });

  it("skips rows without id", () => {
    const parsed = parseIbkrPortfolioAccountsJson([{ currency: "USD" }]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.accounts).toHaveLength(0);
  });
});

describe("fetchIbkrPortfolioAccounts", () => {
  it("parses successful upstream JSON", async () => {
    const { fetchIbkrPortfolioAccounts } = await import("@/modules/ibkr-integration/client-portfolio");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "U1", displayName: "One" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const r = await fetchIbkrPortfolioAccounts({
      baseUrl: "https://cp.test",
      cookieHeader: "a=b",
      fetchFn
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.accounts).toEqual([{ id: "U1", displayLabel: "One", currency: undefined }]);
  });
});
