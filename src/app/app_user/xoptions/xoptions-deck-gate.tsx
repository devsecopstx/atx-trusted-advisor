import Link from "next/link";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { tryIncrementFeatureDailyUsage } from "@/modules/identity/feature-daily-usage";

type Props = {
  children: ReactNode;
};

export async function XoptionsDeckGate({ children }: Props) {
  const session = await getSessionUser();
  if (!session || !canUserLogin(session.roles)) {
    return <>{children}</>;
  }
  if (isGlobalAdmin(session.roles)) {
    return <>{children}</>;
  }

  const limits = await getEffectiveWorkspaceLimitsForUser({
    tenantId: session.tenantId,
    userId: session.userId
  });
  const result = await tryIncrementFeatureDailyUsage({
    feature: "xoptions_deck",
    userId: session.userId,
    tenantId: session.tenantId,
    limit: limits.userXoptionsLimit
  });

  if (result.allowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-950 px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-500/90 font-semibold">xoptions</p>
      <h1 className="text-xl font-semibold text-white max-w-md">Daily deck view limit reached</h1>
      <p className="text-sm text-gray-400 max-w-md">
        Your workspace allows {result.limit} signed-in xoptions deck views per day (UTC). You&apos;ve used{" "}
        {result.count}. Contact your workspace admin to raise the limit, or try again tomorrow.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/xchat"
          className="inline-flex rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-colors"
        >
          Open xChat
        </Link>
        <Link
          href="/account/billing"
          className="inline-flex rounded-full border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
        >
          Billing &amp; plan
        </Link>
      </div>
    </div>
  );
}
