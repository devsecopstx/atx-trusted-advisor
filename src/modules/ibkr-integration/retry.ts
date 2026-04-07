export type IbkrRetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** 0–1 portion of delay used as +/- jitter (default 0.2). */
  jitterRatio?: number;
  shouldRetry?: (error: unknown) => boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Bounded exponential backoff with jitter for IBKR HTTP calls (Phase 1 utility).
 */
export async function withIbkrRetry<T>(fn: () => Promise<T>, options: IbkrRetryOptions): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    jitterRatio = 0.2,
    shouldRetry = () => true
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt >= maxAttempts || !shouldRetry(e)) {
        throw e;
      }
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = exp * jitterRatio * (Math.random() * 2 - 1);
      await sleep(Math.max(0, Math.round(exp + jitter)));
    }
  }
  throw lastError;
}
