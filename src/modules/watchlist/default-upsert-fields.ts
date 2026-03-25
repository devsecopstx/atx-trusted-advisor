import type { AccountOutlook } from "@/modules/core-admin/types";

/** Applied to the watchlist document when desk fields are unset (admin + xChat upsert). */
export const WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE = "growth" as const;

export const WATCHLIST_UPSERT_DEFAULT_OUTLOOK: AccountOutlook = "balanced";

/** Per-row defaults when adding a new symbol and the user does not specify line metadata. */
export const WATCHLIST_ENTRY_DEFAULT_LINE_TYPE = "Stock";

export const WATCHLIST_ENTRY_DEFAULT_STRATEGY = "balanced";
