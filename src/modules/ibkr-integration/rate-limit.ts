export type IbkrSlidingWindowRateLimiter = {
  tryConsume(): boolean;
  reset(): void;
};

/**
 * Simple sliding-window limiter for IBKR Client Portal pacing (Phase 1 — local only).
 * Pass injectable `now` for deterministic tests.
 */
export function createIbkrSlidingWindowRateLimiter(options: {
  maxCalls: number;
  windowMs: number;
  now?: () => number;
}): IbkrSlidingWindowRateLimiter {
  const { maxCalls, windowMs } = options;
  const now = options.now ?? (() => Date.now());
  const stamps: number[] = [];
  return {
    tryConsume() {
      const t = now();
      while (stamps.length > 0 && stamps[0]! <= t - windowMs) {
        stamps.shift();
      }
      if (stamps.length >= maxCalls) {
        return false;
      }
      stamps.push(t);
      return true;
    },
    reset() {
      stamps.length = 0;
    }
  };
}

export function createIbkrRateLimiterFromConfig(config: {
  maxRequestsPerMinute: number;
  now?: () => number;
}): IbkrSlidingWindowRateLimiter {
  return createIbkrSlidingWindowRateLimiter({
    maxCalls: Math.max(1, config.maxRequestsPerMinute),
    windowMs: 60_000,
    now: config.now
  });
}
