import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

describe("proxy middleware matcher — personas API", () => {
  it("includes bare /api/personas so GET list hits edge session grounding", () => {
    expect(config.matcher).toContain("/api/personas");
    expect(config.matcher).toContain("/api/personas/:path*");
  });

  it("includes portfolio/positions/user/reports APIs for billing + grounding", () => {
    expect(config.matcher).toContain("/api/portfolios");
    expect(config.matcher).toContain("/api/portfolios/:path*");
    expect(config.matcher).toContain("/api/positions");
    expect(config.matcher).toContain("/api/positions/:path*");
    expect(config.matcher).toContain("/api/user/:path*");
    expect(config.matcher).toContain("/api/reports/:path*");
  });
});
