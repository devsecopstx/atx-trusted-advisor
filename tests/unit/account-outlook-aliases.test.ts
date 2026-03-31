import { describe, expect, it } from "vitest";

import { parseAccountOutlook } from "@/modules/core-admin/types";

describe("parseAccountOutlook", () => {
  it("maps API aliases up / down / flat to canonical slugs", () => {
    expect(parseAccountOutlook("up")).toBe("bullish");
    expect(parseAccountOutlook("down")).toBe("bearish");
    expect(parseAccountOutlook("flat")).toBe("neutral");
  });

  it("accepts canonical bullish / neutral / bearish", () => {
    expect(parseAccountOutlook("bullish")).toBe("bullish");
    expect(parseAccountOutlook("neutral")).toBe("neutral");
    expect(parseAccountOutlook("bearish")).toBe("bearish");
  });
});
