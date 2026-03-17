type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

type RateLimitInput = {
  key: string;
  windowMs: number;
  max: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
};

type GlobalRateLimitCache = {
  buckets: Map<string, RateLimitBucket>;
};

const globalRateLimitCache = globalThis as typeof globalThis & {
  __xfRateLimit?: GlobalRateLimitCache;
};

const cache: GlobalRateLimitCache = globalRateLimitCache.__xfRateLimit ?? {
  buckets: new Map<string, RateLimitBucket>()
};

if (!globalRateLimitCache.__xfRateLimit) {
  globalRateLimitCache.__xfRateLimit = cache;
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const bucket = cache.buckets.get(input.key);
  if (!bucket || now >= bucket.resetAtMs) {
    const resetAtMs = now + input.windowMs;
    cache.buckets.set(input.key, {
      count: 1,
      resetAtMs
    });
    return {
      allowed: true,
      remaining: Math.max(0, input.max - 1),
      resetAtMs
    };
  }

  if (bucket.count >= input.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAtMs: bucket.resetAtMs
    };
  }

  bucket.count += 1;
  cache.buckets.set(input.key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, input.max - bucket.count),
    resetAtMs: bucket.resetAtMs
  };
}

