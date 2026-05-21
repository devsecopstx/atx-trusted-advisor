import { describe, expect, it } from "vitest";

import { normalizeSymbolResearchNews } from "@/modules/market/symbol-research";

describe("normalizeSymbolResearchNews", () => {
  it("normalizes Yahoo news rows with publisher and relative links", () => {
    const out = normalizeSymbolResearchNews([
      {
        title: "Form 8-K Redwire Corp",
        link: "/news/form-8k",
        publisher: "SEC FILINGS",
        providerPublishTime: 1_748_300_000
      },
      { title: "", link: "https://example.com/x" },
      {
        title: "Earnings beat",
        link: "https://finance.yahoo.com/news/earnings",
        publisher: "MT Newswires"
      }
    ]);

    expect(out).toHaveLength(2);
    expect(out[0]?.link).toBe("https://finance.yahoo.com/news/form-8k");
    expect(out[0]?.publisher).toBe("SEC FILINGS");
    expect(out[0]?.publishedAtLabel).toMatch(/ET$/);
    expect(out[1]?.title).toBe("Earnings beat");
  });
});
