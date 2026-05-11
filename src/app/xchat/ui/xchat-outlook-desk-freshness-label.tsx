import {
    formatOutlookFreshnessLabel,
    type XchatInitialOutlookDesk
} from "@/lib/xchat/xchat-outlook-desk";

type XchatOutlookDeskFreshnessLabelProps = {
  desk: XchatInitialOutlookDesk | null | undefined;
};

/** Server-rendered desk outlook line (cached Mongo/Redis path) for early LCP on /xchat. */
export function XchatOutlookDeskFreshnessLabel({ desk }: XchatOutlookDeskFreshnessLabelProps) {
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
      className="xchat-outlook-freshness-badge"
      style={{
        margin: "0 0 0.35rem",
        fontSize: "0.72rem",
        lineHeight: 1.35,
        color: "var(--xf-text-muted)",
        textAlign: "center"
      }}
    >
      {label}
    </p>
  );
}
