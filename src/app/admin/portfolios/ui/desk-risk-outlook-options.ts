import {
    accountOutlookValues,
    type AccountOutlook
} from "@/modules/core-admin/types";

/** Same triad as {@link Account.riskProfile} for admin desk UIs. */
export const DESK_RISK_PROFILE_OPTIONS = ["conservative", "balanced", "growth"] as const;
export type DeskRiskProfileOption = (typeof DESK_RISK_PROFILE_OPTIONS)[number];

export const DESK_OUTLOOK_LABELS: Record<AccountOutlook, string> = {
  growth: "Growth",
  income: "Income",
  balanced: "Balanced",
  aggressive: "Aggressive"
};

export { accountOutlookValues };
