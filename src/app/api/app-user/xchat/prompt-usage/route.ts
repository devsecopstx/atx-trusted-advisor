import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserByIdCached } from "@/lib/server-request-cache";
import { peekXchatAskUsageCounts } from "@/modules/xchat/ask-usage-limits";
import { mergeXchatPromptLimitsForWorkspace } from "@/modules/xchat/plan-limits";

export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 60 * 60 * 1000;

function utcHoursUntilNextCalendarDay(now: Date): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(0, (next.getTime() - now.getTime()) / ONE_HOUR_MS);
}

function utcMinutesUntilNextClockHour(now: Date): number {
  const msIntoHour = now.getTime() % ONE_HOUR_MS;
  return Math.max(0, (ONE_HOUR_MS - msIntoHour) / 60_000);
}

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }

  const now = new Date();

  let merged: ReturnType<typeof mergeXchatPromptLimitsForWorkspace>;
  let limitsFallback: "plan_defaults" | undefined;
  try {
    const workspaceLimits = await getEffectiveWorkspaceLimitsForUser({
      tenantId: session.tenantId,
      userId: session.userId
    });
    const userDoc = await getCoreUserByIdCached(session.userId);
    const subscriptionPlan = userDoc?.subscriptionPlan;
    merged = mergeXchatPromptLimitsForWorkspace(subscriptionPlan, workspaceLimits);
  } catch {
    merged = mergeXchatPromptLimitsForWorkspace(undefined, undefined);
    limitsFallback = "plan_defaults";
  }

  const counts = await peekXchatAskUsageCounts({
    userId: session.userId,
    tenantId: session.tenantId,
    now
  });

  return NextResponse.json(
    {
      data: {
        usedToday: counts.dayCount,
        usedThisHour: counts.hourCount,
        dailyCap: merged.dailyCap,
        hourlyCap: merged.hourlyCap,
        softLimitPercent: merged.softLimitPercent,
        utcDayResetInHours: utcHoursUntilNextCalendarDay(now),
        utcHourResetInMinutes: utcMinutesUntilNextClockHour(now),
        workspaceCapsEnforced: !isGlobalAdmin(session.roles),
        subscriptionPlan: merged.subscriptionPlan,
        ...(limitsFallback ? { limitsFallback } : {})
      }
    },
    {
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
