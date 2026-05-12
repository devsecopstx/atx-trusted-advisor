import {
    formatOutlookFreshnessLabel,
    type XchatInitialOutlookDesk
} from "@/lib/xchat/xchat-outlook-desk";

type XchatOutlookDeskFreshnessLabelProps = {
  desk: XchatInitialOutlookDesk | null | undefined;
  /** When true, render for the welcome header row (no extra block margin). */
  inline?: boolean;
};

/** Server-rendered desk outlook line (cached Mongo/Redis path) for early LCP on /xchat. */
export function XchatOutlookDeskFreshnessLabel({
  desk,
  inline = false
}: XchatOutlookDeskFreshnessLabelProps) {
  if (!desk) {
    return null;
  }
  const label = formatOutlookFreshnessLabel({
    marketOutlookLabel: desk.marketOutlookLabel,
    lastOutlookRefreshAt: desk.lastOutlookRefreshAt
  });
  if (!label) {
    return null;
  }
  return (
    <p
      aria-live="polite"
      className={
        inline
          ? "xchat-outlook-freshness-badge xchat-outlook-freshness-badge--welcome-row"
          : "xchat-outlook-freshness-badge"
      }
    >
      {label}
    </p>
  );
}
