import { sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
import type { ScheduledTask } from "@/modules/core-admin/types";
import {
    getTenantByHexId,
    listTenantUsersEligibleForOptionsScan,
    updateCoreUserOptionsScanPreferences
} from "@/modules/identity/repository";
import { parseTenantShellBrandingFromTenant } from "@/modules/identity/tenant-shell-appearance";
import { createOptionsScanReport } from "@/modules/xchat/options-action-report-repository";
import { buildOptionsActionReport } from "@/modules/xchat/options-action-scan";

export type ScheduledCategoryResult = {
  status: "success" | "failed";
  output: string;
};

function isDueByFrequency(input: {
  frequency: "weekly" | "monthly" | "off";
  lastRunAt?: Date;
  now: Date;
}): boolean {
  if (input.frequency === "off") {
    return false;
  }
  if (!input.lastRunAt || Number.isNaN(input.lastRunAt.getTime())) {
    return true;
  }
  const elapsedMs = input.now.getTime() - input.lastRunAt.getTime();
  const thresholdDays = input.frequency === "weekly" ? 7 : 30;
  return elapsedMs >= thresholdDays * 24 * 60 * 60 * 1000;
}

export async function runOptionsActionScheduledDigest(
  task: ScheduledTask
): Promise<ScheduledCategoryResult> {
  if (!task.tenantId) {
    return {
      status: "failed",
      output: `options-action-scan: task "${task.name}" is missing tenantId`
    };
  }
  const tenantId = task.tenantId;
  const tenantRow = await getTenantByHexId(tenantId.toHexString());
  const tenantDeskName =
    parseTenantShellBrandingFromTenant(tenantRow)?.displayName?.trim() ||
    tenantRow?.name?.trim() ||
    "Workspace";
  const emailSubject = `${tenantDeskName} — options action scan`;
  const users = await listTenantUsersEligibleForOptionsScan(tenantId);
  const now = new Date();
  let processed = 0;
  let skipped = 0;
  let emailed = 0;
  let failures = 0;

  for (const user of users) {
    const hasAppUserRole = user.roles.some(
      (role) => role === "viewer" || role === "operator" || role === "advisor"
    );
    if (!hasAppUserRole) {
      skipped += 1;
      continue;
    }
    const plan = user.subscriptionPlan ?? "basic";
    if (plan === "basic") {
      skipped += 1;
      continue;
    }
    const prefs = user.optionsScanPreferences;
    if (!isDueByFrequency({ frequency: prefs.frequency, lastRunAt: prefs.lastRunAt, now })) {
      skipped += 1;
      continue;
    }
    try {
      const report = await buildOptionsActionReport({
        userId: user.userId.toHexString(),
        tenantId: user.tenantId.toHexString(),
        subscriptionPlan: plan
      });
      await createOptionsScanReport({
        userId: user.userId,
        tenantId,
        source: "scheduled",
        frequency: prefs.frequency,
        deliveryChannel: prefs.deliveryChannel,
        rows: report.rows,
        truncated: report.truncated,
        reportMarkdown: report.asMarkdown
      });
      await updateCoreUserOptionsScanPreferences(user.userId, { lastRunAt: now });
      processed += 1;
      if (prefs.deliveryChannel === "email") {
        const sent = await sendDeskPlainEmailWithRetry(
          user.email,
          emailSubject,
          report.asMarkdown
        );
        if (sent) {
          emailed += 1;
        }
      }
    } catch (error) {
      failures += 1;
      console.error("[options-action-scheduled] failed to generate digest", {
        userId: user.userId.toHexString(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const status: ScheduledCategoryResult["status"] = failures > 0 ? "failed" : "success";
  return {
    status,
    output: `options-action-scan scheduled digest: processed=${processed}, skipped=${skipped}, emailed=${emailed}, failures=${failures}`
  };
}
