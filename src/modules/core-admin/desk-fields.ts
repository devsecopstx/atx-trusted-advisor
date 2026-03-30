import { accountOutlookValues, type AccountOutlook } from "@/modules/core-admin/types";

/** Stored slugs for desk risk; UI label for `growth` is Aggressive. */
export const DESK_RISK_PROFILE_OPTIONS = ["conservative", "balanced", "growth"] as const;
export type DeskRiskProfileOption = (typeof DESK_RISK_PROFILE_OPTIONS)[number];

export const DESK_RISK_DISPLAY_LABELS: Record<DeskRiskProfileOption, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  growth: "Aggressive"
};

export const DESK_OUTLOOK_LABELS: Record<AccountOutlook, string> = {
  bullish: "Bullish / up",
  neutral: "Neutral / flat",
  bearish: "Bearish / down"
};

/** App user account desk — card picker (same slugs as API). */
export const DESK_OUTLOOK_CARD_OPTIONS: ReadonlyArray<{
  value: AccountOutlook;
  title: string;
  description: string;
}> = [
  { value: "bullish", title: "Bullish / up", description: "Positive directional bias" },
  { value: "neutral", title: "Neutral / flat", description: "Sideways or balanced view" },
  { value: "bearish", title: "Bearish / down", description: "Negative or defensive bias" }
];

export { accountOutlookValues };
