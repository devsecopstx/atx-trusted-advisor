import { getDb } from "@/lib/mongodb";
import type { SubscriptionPlan } from "@/modules/identity/types";
import { getPlanLimits } from "@/modules/xchat/plan-limits";

const XCHAT_USAGE_COLLECTION = "xchat_usage_limits";
const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

  if (minuteBucket.count > input.perMinuteLimit) {
    const minuteWindowEndMs = minuteBucket.bucketStart.getTime() + ONE_MINUTE_MS;
    return {
      allowed: false,
      code: "xchat_rate_limit_exceeded",
      retryAfterSeconds: Math.max(1, Math.ceil((minuteWindowEndMs - Date.now()) / 1000)),
      remainingMinute: 0
    };
  }

  const remainingMinute = Math.max(0, input.perMinuteLimit - minuteBucket.count);

  if (!input.enforceDailyLimit) {
    return {
      allowed: true,
      remainingMinute
    };
  }

  const hourlyCap =
    input.hourlyPromptLimit !== undefined && input.hourlyPromptLimit > 0
      ? Math.max(1, Math.floor(input.hourlyPromptLimit))
      : 0;

  let remainingHour: number | undefined;
  if (hourlyCap > 0) {
    const hourBucket = await incrementUsageBucket({
      kind: "hour",
      userId: input.userId,
      tenantId: input.tenantId,
      now
    });
    if (hourBucket.count > hourlyCap) {
      const hourEndMs = hourBucket.bucketStart.getTime() + ONE_HOUR_MS;
      return {
        allowed: false,
        code: "xchat_hourly_limit_exceeded",
        retryAfterSeconds: Math.max(1, Math.ceil((hourEndMs - Date.now()) / 1000)),
        remainingMinute,
        remainingHour: 0,
        hourlyLimit: hourlyCap
      };
    }
    remainingHour = Math.max(0, hourlyCap - hourBucket.count);
  }

  const dailyLimit =
    input.dailyPromptLimit !== undefined
      ? Math.max(1, Math.floor(input.dailyPromptLimit))
      : getPlanLimits(input.plan).maxPromptsPerDay;
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
      dailyLimit
    };
  }

  return {
    allowed: true,
    remainingMinute,
    remainingHour,
    hourlyLimit: hourlyCap > 0 ? hourlyCap : undefined,
    remainingDay: Math.max(0, dailyLimit - dayBucket.count),
    dailyLimit
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
  return `${input.kind}:${input.userId}:${tenantSegment}:${input.bucketStart.toISOString()}`;
}
