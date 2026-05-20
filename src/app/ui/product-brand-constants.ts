/**
 * User-facing product naming (xChat shell, marketing, footer, legal prose).
 * Visual lockup: aTx mark + ⚡ + “Trusted Advisory”; user-facing product name **aTx Advisor**. Legacy persona slug “xFinance” may remain in backend defaults.
 */

export {
    FINTECH_ADVISOR_PROD_ORIGIN,
    FINTECH_ADVISOR_STAGING_ORIGIN,
    XFINANCE_BRAND_SUBLINE
} from "@/lib/xfinance-brand";

export const USER_PRODUCT_HOME_ARIA_LABEL = "aTx Trusted Advisory — home";

export const USER_PRODUCT_DESCRIPTOR_LINE =
  "aTx Trusted Advisory · xChat · xOptions — institutional options alpha in one workspace.";

/** Shown under the tenant display name on `/portfolios` when `xf_tenant_tagline` is unset. */
export const PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE = "No Atoms Moved. Just Gains Earned.";
