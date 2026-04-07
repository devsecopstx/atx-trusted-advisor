import { afterEach, describe, expect, it, vi } from "vitest";

import { withIbkrRetry } from "@/modules/ibkr-integration/retry";

describe("withIbkrRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns first successful result", async () => {
    let n = 0;
    const r = await withIbkrRetry(
      async () => {
        n += 1;
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 4 }
    );
    expect(r).toBe("ok");
    expect(n).toBe(1);
  });

  it("retries until maxAttempts then throws", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const p = withIbkrRetry(
      async () => {
        calls += 1;
        throw new Error("fail");
      },
      { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 10, shouldRetry: () => true }
    );
    const settled = expect(p).rejects.toThrow("fail");
    await vi.runAllTimersAsync();
    await settled;
    expect(calls).toBe(2);
  });

  it("does not retry when shouldRetry returns false", async () => {
    let calls = 0;
    await expect(
      withIbkrRetry(
        async () => {
          calls += 1;
          throw new Error("no-retry");
        },
        {
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 2,
          shouldRetry: (e) => (e as Error).message !== "no-retry"
        }
      )
    ).rejects.toThrow("no-retry");
    expect(calls).toBe(1);
  });
});
