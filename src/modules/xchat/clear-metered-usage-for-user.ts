import { getDb } from "@/lib/mongodb";

const XCHAT_USAGE_COLLECTION = "xchat_usage_limits";
const FEATURE_DAILY_COLLECTION = "app_feature_daily_usage";

export type ClearMeteredUsageForUserResult = {
  xchatUsageDeleted: number;
  featureDailyDeleted: number;
};

/**
 * Deletes xChat rate/daily buckets and app feature daily usage rows for a user.
 * Used when a subscription plan changes or an admin resets meters.
 */
export async function clearMeteredUsageForUser(userIdHex: string): Promise<ClearMeteredUsageForUserResult> {
  const id = userIdHex.trim();
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return { xchatUsageDeleted: 0, featureDailyDeleted: 0 };
  }
  const db = await getDb();
  const [xchat, featureDaily] = await Promise.all([
    db.collection(XCHAT_USAGE_COLLECTION).deleteMany({ userId: id }),
    db.collection(FEATURE_DAILY_COLLECTION).deleteMany({ userId: id })
  ]);
  return {
    xchatUsageDeleted: xchat.deletedCount,
    featureDailyDeleted: featureDaily.deletedCount
  };
}
