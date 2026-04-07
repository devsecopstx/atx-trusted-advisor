import { describe, expect, it } from "vitest";

import { createIbkrSlidingWindowRateLimiter } from "@/modules/ibkr-integration/rate-limit";

describe("createIbkrSlidingWindowRateLimiter", () => {
  it("allows up to maxCalls within the window", () => {
    const t = 1_000_000;
    const limiter = createIbkrSlidingWindowRateLimiter({
      maxCalls: 3,
      windowMs: 60_000,
      now: () => t
    });
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it("frees slots after the window slides", () => {
    let t = 0;
    const limiter = createIbkrSlidingWindowRateLimiter({
      maxCalls: 2,
      windowMs: 100,
      now: () => t
    });
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
    t = 101;
    expect(limiter.tryConsume()).toBe(true);
  });

  it("reset clears the window", () => {
    const limiter = createIbkrSlidingWindowRateLimiter({
      maxCalls: 1,
      windowMs: 60_000,
      now: () => 5
    });
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
    limiter.reset();
    expect(limiter.tryConsume()).toBe(true);
  });
});
