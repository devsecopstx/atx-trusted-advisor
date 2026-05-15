import { getDb } from "@/lib/mongodb";
import type { SubscriptionPlan } from "@/modules/identity/types";
import { getPlanLimits } from "@/modules/xchat/plan-limits";

const XCHAT_USAGE_COLLECTION = "xchat_usage_limits";
const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Canonical bucket ISO — must match Spring `XchatUsageLimitService` and `Date.toISOString()`. */
export function formatXchatUsageBucketStartIso(bucketStart: Date): string {
  return bucketStart.toISOString();
}

/** Legacy Spring `Instant.toString()` when fractional seconds are zero (pre-parity keys). */
export function legacyXchatUsageBucketStartIso(bucketStart: Date): string {
  return bucketStart.toISOString().replace(/\.000Z$/, "Z");
}

type UsageBucketKind = "minute" | "hour" | "day";

type UsageBucketDocument = {
  key: string;
  kind: UsageBucketKind;
  userId: string;
  tenantId?: string;
  bucketStart: Date;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type UsageLimitInput = {
  userId: string;
  tenantId?: string;
  plan?: SubscriptionPlan;
  perMinuteLimit: number;
  enforceDailyLimit: boolean;
  /** UTC calendar-day cap (merged tenant `userChatLimit`). */
  dailyPromptLimit?: number;
  /** UTC clock-hour cap when > 0 (merged tenant `userChatHourlyLimit`). */
  hourlyPromptLimit?: number;
};

export type UsageLimitResult = {
  allowed: boolean;
  code?:
    | "xchat_rate_limit_exceeded"
    | "xchat_hourly_limit_exceeded"
    | "xchat_daily_limit_exceeded";
  retryAfterSeconds?: number;
  remainingMinute?: number;
  remainingHour?: number;
  remainingDay?: number;
  hourlyLimit?: number;
  dailyLimit?: number;
  /** Post-increment bucket counts (observability / admin debug). */
  observedMinuteCount?: number;
  observedHourCount?: number;
  observedDayCount?: number;
  /** Effective caps after tenant + plan merge (0 hourly = no hourly cap). */
  effectiveDailyLimit?: number;
  effectiveHourlyLimit?: number;
};

let ensureUsageIndexesPromise: Promise<void> | null = null;

export async function enforceDistributedAskUsageLimit(
  input: UsageLimitInput
): Promise<UsageLimitResult> {
  await ensureUsageIndexes();
  const now = new Date();

  const minuteBucket = await incrementUsageBucket({
    kind: "minute",
    userId: input.userId,
    tenantId: input.tenantId,
    now
  });

  const perMinuteCap =
    typeof input.perMinuteLimit === "number" && Number.isFinite(input.perMinuteLimit)
      ? Math.floor(input.perMinuteLimit)
      : 0;

  if (perMinuteCap > 0 && minuteBucket.count > perMinuteCap) {
    const minuteWindowEndMs = minuteBucket.bucketStart.getTime() + ONE_MINUTE_MS;
    return {
      allowed: false,
      code: "xchat_rate_limit_exceeded",
      retryAfterSeconds: Math.max(1, Math.ceil((minuteWindowEndMs - Date.now()) / 1000)),
      remainingMinute: 0,
      observedMinuteCount: minuteBucket.count
    };
  }

  const remainingMinute =
    perMinuteCap > 0 ? Math.max(0, perMinuteCap - minuteBucket.count) : undefined;

  if (!input.enforceDailyLimit) {
    /**
     * Admins / sessions without workspace caps: still record UTC hour + day buckets so
     * `GET /api/app-user/xchat/prompt-usage` and the rail/composer meter match real send volume.
     * Enforcement against caps remains off (`workspaceCapsEnforced: false` in the API).
     */
    const hourAd = await incrementUsageBucket({
      kind: "hour",
      userId: input.userId,
      tenantId: input.tenantId,
      now
    });
    const dayAd = await incrementUsageBucket({
      kind: "day",
      userId: input.userId,
      tenantId: input.tenantId,
      now
    });
    return {
      allowed: true,
      remainingMinute,
      observedMinuteCount: minuteBucket.count,
      observedHourCount: hourAd.count,
      observedDayCount: dayAd.count
    };
  }

  const hourlyCap =
    input.hourlyPromptLimit !== undefined && input.hourlyPromptLimit > 0
      ? Math.max(1, Math.floor(input.hourlyPromptLimit))
      : 0;

  const dailyFromInput =
    input.dailyPromptLimit !== undefined &&
    Number.isFinite(input.dailyPromptLimit) &&
    input.dailyPromptLimit > 0
      ? Math.max(1, Math.floor(input.dailyPromptLimit))
      : undefined;
  const dailyLimit =
    dailyFromInput ?? getPlanLimits(input.plan).maxPromptsPerDay;

  /**
   * Always bump the UTC clock-hour bucket when workspace caps apply so
   * `peekXchatAskUsageCounts` / prompt-usage stay aligned with sends (hourly enforcement is optional).
   */
  const hourBucket = await incrementUsageBucket({
    kind: "hour",
    userId: input.userId,
    tenantId: input.tenantId,
    now
  });

  let remainingHour: number | undefined;
  if (hourlyCap > 0) {
    if (hourBucket.count > hourlyCap) {
      const hourEndMs = hourBucket.bucketStart.getTime() + ONE_HOUR_MS;
      return {
        allowed: false,
        code: "xchat_hourly_limit_exceeded",
        retryAfterSeconds: Math.max(1, Math.ceil((hourEndMs - Date.now()) / 1000)),
        remainingMinute,
        remainingHour: 0,
        hourlyLimit: hourlyCap,
        observedMinuteCount: minuteBucket.count,
        observedHourCount: hourBucket.count,
        effectiveDailyLimit: dailyLimit,
        effectiveHourlyLimit: hourlyCap
      };
    }
    remainingHour = Math.max(0, hourlyCap - hourBucket.count);
  }

  const dayBucket = await incrementUsageBucket({
    kind: "day",
    userId: input.userId,
    tenantId: input.tenantId,
    now
  });

  if (dayBucket.count > dailyLimit) {
    const nextDayStartMs = dayBucket.bucketStart.getTime() + ONE_DAY_MS;
    return {
      allowed: false,
      code: "xchat_daily_limit_exceeded",
      retryAfterSeconds: Math.max(1, Math.ceil((nextDayStartMs - Date.now()) / 1000)),
      remainingMinute,
      remainingHour,
      hourlyLimit: hourlyCap > 0 ? hourlyCap : undefined,
      remainingDay: 0,
      dailyLimit,
      observedMinuteCount: minuteBucket.count,
      observedHourCount: hourBucket.count,
      observedDayCount: dayBucket.count,
      effectiveDailyLimit: dailyLimit,
      effectiveHourlyLimit: hourlyCap
    };
  }

  return {
    allowed: true,
    remainingMinute,
    remainingHour,
    hourlyLimit: hourlyCap > 0 ? hourlyCap : undefined,
    remainingDay: Math.max(0, dailyLimit - dayBucket.count),
    dailyLimit,
    observedMinuteCount: minuteBucket.count,
    observedHourCount: hourBucket.count,
    observedDayCount: dayBucket.count,
    effectiveDailyLimit: dailyLimit,
    effectiveHourlyLimit: hourlyCap
  };
}

/** Read current UTC minute/hour/day buckets without incrementing (prompt usage meter). */
export async function peekXchatAskUsageCounts(input: {
  userId: string;
  tenantId?: string;
  now?: Date;
}): Promise<{
  minuteCount: number;
  hourCount: number;
  dayCount: number;
}> {
  await ensureUsageIndexes();
  const now = input.now ?? new Date();
  const minuteStart = getBucketStart("minute", now);
  const hourStart = getBucketStart("hour", now);
  const dayStart = getBucketStart("day", now);
  const keys = usagePeekKeysForBucket({
    kind: "minute",
    userId: input.userId,
    tenantId: input.tenantId,
    bucketStart: minuteStart
  }).concat(
    usagePeekKeysForBucket({
      kind: "hour",
      userId: input.userId,
      tenantId: input.tenantId,
      bucketStart: hourStart
    }),
    usagePeekKeysForBucket({
      kind: "day",
      userId: input.userId,
      tenantId: input.tenantId,
      bucketStart: dayStart
    })
  );
  const coll = (await getDb()).collection<UsageBucketDocument>(XCHAT_USAGE_COLLECTION);
  const docs = await coll.find({ key: { $in: keys } }).project({ key: 1, count: 1 }).toArray();
  const map = new Map(docs.map((d) => [d.key, d.count]));
  return {
    minuteCount: resolveUsageBucketCount(map, {
      kind: "minute",
      userId: input.userId,
      tenantId: input.tenantId,
      bucketStart: minuteStart
    }),
    hourCount: resolveUsageBucketCount(map, {
      kind: "hour",
      userId: input.userId,
      tenantId: input.tenantId,
      bucketStart: hourStart
    }),
    dayCount: resolveUsageBucketCount(map, {
      kind: "day",
      userId: input.userId,
      tenantId: input.tenantId,
      bucketStart: dayStart
    })
  };
}

async function ensureUsageIndexes(): Promise<void> {
  if (!ensureUsageIndexesPromise) {
    ensureUsageIndexesPromise = createUsageIndexes();
  }
  await ensureUsageIndexesPromise;
}

async function createUsageIndexes(): Promise<void> {
  const db = await getDb();
  const usageCollection = db.collection<UsageBucketDocument>(XCHAT_USAGE_COLLECTION);
  await usageCollection.createIndex({ key: 1 }, { unique: true, name: "uniq_xchat_usage_key" });
  await usageCollection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "ttl_xchat_usage_expires_at" }
  );
}

async function incrementUsageBucket(input: {
  kind: UsageBucketKind;
  userId: string;
  tenantId?: string;
  now: Date;
}): Promise<Pick<UsageBucketDocument, "bucketStart" | "count">> {
  const bucketStart = getBucketStart(input.kind, input.now);
  const key = buildUsageKey({
    kind: input.kind,
    userId: input.userId,
    tenantId: input.tenantId,
    bucketStart
  });
  const now = new Date();
  const updated = await (await getDb())
    .collection<UsageBucketDocument>(XCHAT_USAGE_COLLECTION)
    .findOneAndUpdate(
      { key },
      {
        $setOnInsert: {
          key,
          kind: input.kind,
          userId: input.userId,
          tenantId: input.tenantId,
          bucketStart,
          expiresAt: computeBucketExpiry(input.kind, bucketStart),
          createdAt: now
        },
        $set: {
          updatedAt: now
        },
        $inc: {
          count: 1
        }
      },
      { upsert: true, returnDocument: "after" }
    );

  if (!updated) {
    throw new Error("Failed to update xchat usage bucket");
  }

  return {
    bucketStart: updated.bucketStart,
    count: updated.count
  };
}

function getBucketStart(kind: UsageBucketKind, now: Date): Date {
  if (kind === "minute") {
    return new Date(Math.floor(now.getTime() / ONE_MINUTE_MS) * ONE_MINUTE_MS);
  }
  if (kind === "hour") {
    return new Date(Math.floor(now.getTime() / ONE_HOUR_MS) * ONE_HOUR_MS);
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function computeBucketExpiry(kind: UsageBucketKind, bucketStart: Date): Date {
  if (kind === "minute") {
    return new Date(bucketStart.getTime() + 2 * ONE_DAY_MS);
  }
  if (kind === "hour") {
    return new Date(bucketStart.getTime() + 3 * ONE_DAY_MS);
  }
  return new Date(bucketStart.getTime() + 35 * ONE_DAY_MS);
}

function buildUsageKey(input: {
  kind: UsageBucketKind;
  userId: string;
  tenantId?: string;
  bucketStart: Date;
}): string {
  const tenantSegment = input.tenantId?.trim() ? input.tenantId.trim() : "tenant:none";
  return `${input.kind}:${input.userId}:${tenantSegment}:${formatXchatUsageBucketStartIso(input.bucketStart)}`;
}

function usagePeekKeysForBucket(input: {
  kind: UsageBucketKind;
  userId: string;
  tenantId?: string;
  bucketStart: Date;
}): string[] {
  const canonical = buildUsageKey(input);
  const legacyIso = legacyXchatUsageBucketStartIso(input.bucketStart);
  const canonicalIso = formatXchatUsageBucketStartIso(input.bucketStart);
  if (legacyIso === canonicalIso) {
    return [canonical];
  }
  const tenantSegment = input.tenantId?.trim() ? input.tenantId.trim() : "tenant:none";
  const legacyKey = `${input.kind}:${input.userId}:${tenantSegment}:${legacyIso}`;
  return legacyKey === canonical ? [canonical] : [canonical, legacyKey];
}

function resolveUsageBucketCount(
  map: Map<string, number>,
  input: {
    kind: UsageBucketKind;
    userId: string;
    tenantId?: string;
    bucketStart: Date;
  }
): number {
  let total = 0;
  for (const key of usagePeekKeysForBucket(input)) {
    const count = map.get(key);
    if (typeof count === "number") {
      total += count;
    }
  }
  return total;
}
