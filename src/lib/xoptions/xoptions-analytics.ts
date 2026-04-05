"use client";

export type XoptionsAnalyticsEventName =
  | "xoptions_watchlist_add"
  | "xoptions_xchat_open"
  | "xoptions_scenario_save"
  | "xoptions_export_print";

export const XOPTIONS_ANALYTICS_EVENT = "xfinance:xoptions-analytics";

export function trackXoptionsEvent(
  eventName: XoptionsAnalyticsEventName,
  metadata: Record<string, string | number | boolean | null> = {}
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(XOPTIONS_ANALYTICS_EVENT, {
      detail: {
        eventName,
        metadata,
        timestamp: Date.now()
      }
    })
  );
}
