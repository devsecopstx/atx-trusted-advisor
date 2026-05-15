import { describe, expect, it } from "vitest";

import { resolvePolicyPathForRequest } from "@/modules/platform/tenant-ux-proxy-policy-path";

describe("tenant ux proxy policy path audit", () => {
  it("covers gated API families used by app-user surfaces", () => {
    const cases: Array<[string, string]> = [
      ["/api/xchat/ask", "/xchat"],
      ["/api/xchat/ask/stream", "/xchat"],
      ["/api/app-user/xchat/voice-transcribe", "/xchat"],
      ["/api/app-user/find-options/bootstrap", "/xoptions"],
      ["/api/app-user/xoptions/quant-trader/context", "/xoptions"],
      ["/api/app-user/xoptions/quant-trader/run", "/xoptions"],
      ["/api/strategy-options", "/xoptions"],
      ["/api/strategy-options/expirations", "/xoptions"],
      ["/api/portfolios/507f1f77bcf86cd799439011/alerts", "/portfolio"],
      ["/api/portfolios/507f1f77bcf86cd799439011/alerts/abc/narrative", "/portfolio"],
      ["/api/integrations/ibkr/status", "/account"],
      ["/api/integrations/ibkr/accounts", "/account"],
      ["/api/tasks", "/workspace/tasks"],
      ["/api/tasks/task-1/runs", "/workspace/tasks"],
      ["/api/strategy-jobs/job-1/status", "/xoptions"],
      ["/api/recommendations", "/portfolio"],
      ["/api/recommendations/rec-1", "/portfolio"],
      ["/api/user/workspace-portfolio", "/workspace"],
      ["/api/import/broker", "/import-activity"],
      ["/api/user/watchlist", "/watchlist"]
    ];
    for (const [pathname, expected] of cases) {
      expect(resolvePolicyPathForRequest(pathname)).toBe(expected);
    }
  });
});
