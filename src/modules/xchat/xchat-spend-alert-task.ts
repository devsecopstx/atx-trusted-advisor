import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { getTenantByHexId } from "@/modules/identity/repository";
import {
    appendTenantIdToScheduledTaskOutput,
    type ScheduledCategoryResult
} from "@/modules/scanner/core-scanner-service";
import type { XChatSessionLog } from "@/modules/xchat/types";

const CHAT_LOGS = "xchat_logs";

async function sumVendorUsdTicks24h(tenantId: ObjectId): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const db = await getDb();
  type Agg = { total: number };
  const [row] = await db
    .collection<XChatSessionLog>(CHAT_LOGS)
    .aggregate<Agg>([
      {
        $match: {
          tenantId,
          createdAt: { $gte: since },
          "xaiUsage.costUsdTicks": { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null as null,
          total: { $sum: { $ifNull: ["$xaiUsage.costUsdTicks", 0] } }
        }
      }
    ])
    .toArray();
  return row?.total ?? 0;
}

/**
 * Tenant scheduled job: compare rolling **24h** sum of vendor **`costUsdTicks`** on **`xchat_logs`**
 * against **`core_tenants.tenantPreferences.xchat_daily_spend_alert_usd_ticks`** (optional).
 */
export async function runXchatTenantSpendAlertTask(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  if (!task.tenantId) {
    return {
      status: "failed",
      output: appendTenantIdToScheduledTaskOutput(
        "xchat_spend_alert requires a tenant-scoped scheduled task row",
        undefined
      )
    };
  }

  const tenantHex = task.tenantId.toHexString();
  const tenant = await getTenantByHexId(tenantHex);
  const thresholdRaw = tenant?.tenantPreferences?.xchat_daily_spend_alert_usd_ticks;
  const threshold =
    typeof thresholdRaw === "number"
      ? thresholdRaw
      : typeof thresholdRaw === "string"
        ? Number(thresholdRaw)
        : NaN;

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return {
      status: "success",
      output: appendTenantIdToScheduledTaskOutput(
        "xchat_spend_alert: skipped — set tenantPreferences.xchat_daily_spend_alert_usd_ticks on core_tenants (positive number)",
        task.tenantId
      )
    };
  }

  const sumTicks = await sumVendorUsdTicks24h(task.tenantId);
  if (sumTicks >= threshold) {
    return {
      status: "success",
      output: appendTenantIdToScheduledTaskOutput(
        `xchat_spend_alert: THRESHOLD BREACH rolling_24h_vendor_usd_ticks=${sumTicks} threshold=${threshold}`,
        task.tenantId
      ),
      auditDetails: {
        xchatSpendAlert: true,
        rolling24hVendorUsdTicks: sumTicks,
        threshold
      }
    };
  }

  return {
    status: "success",
    output: appendTenantIdToScheduledTaskOutput(
      `xchat_spend_alert: ok rolling_24h_vendor_usd_ticks=${sumTicks} threshold=${threshold}`,
      task.tenantId
    )
  };
}
