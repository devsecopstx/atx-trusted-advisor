import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

describe("proxy middleware matcher — personas API", () => {
  it("includes bare /api/personas so GET list hits edge session grounding", () => {
    expect(config.matcher).toContain("/api/personas");
    expect(config.matcher).toContain("/api/personas/:path*");
  });
});
