"use client";

import { XchatUsageMeter } from "@/app/xchat/ui/usage-meter";
import { XchatSidebarTokenStats } from "@/app/xchat/ui/xchat-sidebar-token-stats";

export type XchatUsageStatusRowProps = {
  variant: "composer" | "rail";
  refreshSignal?: number;
};

/** Prompt cap meter + token totals on one row (rail + composer). */
export function XchatUsageStatusRow({ variant, refreshSignal = 0 }: XchatUsageStatusRowProps) {
  return (
    <div
      aria-label="xChat usage"
      className={`xchat-status-meter-row xchat-status-meter-row--${variant}`}
      role="region"
    >
      <XchatUsageMeter layout="inline" refreshSignal={refreshSignal} variant={variant} />
      <span aria-hidden className="xchat-status-meter-row__sep">
        ·
      </span>
      <XchatSidebarTokenStats layout="inline" />
    </div>
  );
}
