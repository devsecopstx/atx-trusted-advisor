import { describe, expect, it } from "vitest";

import {
    deriveFirstSessionProgress,
    isUsefulXchatAsk
} from "@/lib/onboarding/first-session-progress";

describe("first session progress", () => {
  it("stays incomplete until holdings, watchlist, and a useful ask exist", () => {
    const partial = deriveFirstSessionProgress({
      hasHoldings: true,
      hasWatchlist: false,
      hasUsefulAsk: false
    });
    expect(partial.complete).toBe(false);
    expect(partial.completedCount).toBe(1);
    expect(partial.steps.find((step) => !step.done)?.id).toBe("watchlist");
  });

  it("completes when all three desk steps are done", () => {
    const done = deriveFirstSessionProgress({
      hasHoldings: true,
      hasWatchlist: true,
      hasUsefulAsk: true
    });
    expect(done.complete).toBe(true);
    expect(done.completedCount).toBe(3);
  });

  it("ignores short greetings as the first useful ask", () => {
    expect(isUsefulXchatAsk("hi")).toBe(false);
    expect(isUsefulXchatAsk("Covered calls on TSLA for weekly income")).toBe(true);
  });
});
