import { XCHAT_WHEEL_CC_SCAN_PROMPT } from "@/modules/xchat/xchat-hnwi-templates";

/** Mongo + API slug keys for HNWI v2.1 prompt templates. */
export const HNWI_PROMPT_TEMPLATE_V21_SLUGS = [
  "hnwi-v21-concentration",
  "hnwi-v21-wheel-cc",
  "hnwi-v21-protective-puts",
  "hnwi-v21-watchlist-pass",
  "hnwi-v21-options-desk"
] as const;

export type HnwiPromptTemplateV21Slug = (typeof HNWI_PROMPT_TEMPLATE_V21_SLUGS)[number];

export function isHnwiPromptTemplateV21Slug(value: string): value is HnwiPromptTemplateV21Slug {
  return (HNWI_PROMPT_TEMPLATE_V21_SLUGS as readonly string[]).includes(value);
}

/** Button labels match the five built-in HNWI / scan composer prompts (exact strings). */
export const HNWI_V21_QUICK_ACTION_LABELS: Record<HnwiPromptTemplateV21Slug, string> = {
  "hnwi-v21-concentration":
    "Review concentration: top notionals, sector skew, one diversify or hedge idea. Use workspace holdings if visible.",
  "hnwi-v21-wheel-cc": XCHAT_WHEEL_CC_SCAN_PROMPT,
  "hnwi-v21-protective-puts":
    "Protective put checklist for largest equity lines: tenor, strike vs cost, rolling — use workspace positions when visible.",
  "hnwi-v21-watchlist-pass":
    "Summarize workspace watchlist: themes, overlap with holdings, top three names for an options pass this week.",
  "hnwi-v21-options-desk": "Scan my options from holdings + watchlist."
};

const V21_BODY: Record<HnwiPromptTemplateV21Slug, string> = {
  "hnwi-v21-concentration": HNWI_V21_QUICK_ACTION_LABELS["hnwi-v21-concentration"],
  "hnwi-v21-wheel-cc": HNWI_V21_QUICK_ACTION_LABELS["hnwi-v21-wheel-cc"],
  "hnwi-v21-protective-puts": HNWI_V21_QUICK_ACTION_LABELS["hnwi-v21-protective-puts"],
  "hnwi-v21-watchlist-pass": HNWI_V21_QUICK_ACTION_LABELS["hnwi-v21-watchlist-pass"],
  "hnwi-v21-options-desk": HNWI_V21_QUICK_ACTION_LABELS["hnwi-v21-options-desk"]
};

export const HNWI_PROMPT_TEMPLATE_V21_VERSION = "2.1";

export type HnwiV21BiasDefaults = {
  riskProfile?: "conservative" | "moderate" | "aggressive";
  outlook?: "bullish" | "bearish" | "neutral";
};

export type HnwiV21DefaultRow = {
  slug: HnwiPromptTemplateV21Slug;
  version: typeof HNWI_PROMPT_TEMPLATE_V21_VERSION;
  prompt_text: string;
  output_schema: string;
  active: true;
  bias_defaults: HnwiV21BiasDefaults;
};

export function listHnwiV21DefaultSeedRows(): HnwiV21DefaultRow[] {
  return HNWI_PROMPT_TEMPLATE_V21_SLUGS.map((slug) => ({
    slug,
    version: HNWI_PROMPT_TEMPLATE_V21_VERSION,
    prompt_text: V21_BODY[slug],
    output_schema: "hnwi_desk_report_v2.1_markdown",
    active: true as const,
    bias_defaults: defaultBiasForSlug(slug)
  }));
}

function defaultBiasForSlug(slug: HnwiPromptTemplateV21Slug): HnwiV21BiasDefaults {
  switch (slug) {
    case "hnwi-v21-concentration":
      return { riskProfile: "moderate", outlook: "neutral" };
    case "hnwi-v21-wheel-cc":
      return { riskProfile: "moderate", outlook: "neutral" };
    case "hnwi-v21-protective-puts":
      return { riskProfile: "conservative", outlook: "bearish" };
    case "hnwi-v21-watchlist-pass":
      return { riskProfile: "moderate", outlook: "bullish" };
    case "hnwi-v21-options-desk":
      return { riskProfile: "moderate", outlook: "neutral" };
    default: {
      const _exhaustive: never = slug;
      return _exhaustive;
    }
  }
}

export function getBuiltinHnwiV21PromptText(slug: HnwiPromptTemplateV21Slug): string {
  return V21_BODY[slug];
}
