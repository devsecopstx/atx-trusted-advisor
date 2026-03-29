import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

const ACCESS_REQUESTS_COLLECTION = "admin_access_requests";
const ACTIONABLE_STATUSES = ["new", "triaged", "pending"] as const;

function tenantFilter(tenantId?: ObjectId): Record<string, unknown> {
  if (!tenantId) {
    return {};
  }
  return { tenantId };
}

export async function runUserAccessRequestsTask(
  task: ScheduledTask
): Promise<ScheduledCategoryResult> {
  const db = await getDb();
  const tenantIdHex = task.tenantId?.toHexString() ?? null;
  const tenantScoped = tenantFilter(task.tenantId);

  const [actionable, approvedToday] = await Promise.all([
    db.collection(ACCESS_REQUESTS_COLLECTION).countDocuments({
      ...tenantScoped,
      status: { $in: ACTIONABLE_STATUSES }
    }),
    db.collection(ACCESS_REQUESTS_COLLECTION).countDocuments({
      ...tenantScoped,
      status: "approved",
      reviewedAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    })
  ]);

  return {
    status: "success",
    output: `user_access_requests: actionable=${actionable} approved_last_24h=${approvedToday}`,
    auditDetails: {
      tenantId: tenantIdHex,
      actionableCount: actionable,
      approvedLast24h: approvedToday
    }
  };
}
