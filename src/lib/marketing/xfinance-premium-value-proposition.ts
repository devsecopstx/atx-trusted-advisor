/** Shared marketing copy — Austin HNWI investors & Investment Advisors. */

export type XfinancePremiumCapability = {
  readonly title: string;
  readonly description: string;
};

export const XFINANCE_PREMIUM_VALUE_EYEBROW = "What xFinance delivers";

export const XFINANCE_PREMIUM_VALUE_HEADLINE =
  "What xFinance Delivers — and Why It Commands a Premium";

export const XFINANCE_PREMIUM_VALUE_INTRO =
  "Built in Austin for high-net-worth retail investors and the Investment Advisors who run their books — one auditable workspace instead of a patchwork of terminals, spreadsheets, and generic chatbots.";

export const XFINANCE_PREMIUM_CAPABILITIES: readonly XfinancePremiumCapability[] = [
  {
    title: "Conversational xChat",
    description:
      "Multi-agent orchestration with RAG-backed options strategy knowledge — conservative income, balanced, and aggressive postures grounded in your workspace."
  },
  {
    title: "Production xOptions builder",
    description:
      "Real-time chains, expirations, payoff visualization, Greeks, volume/OI heatmaps, and strategy-job orchestration from idea to validated structure."
  },
  {
    title: "Full portfolio desk",
    description:
      "Portfolio, watchlist, alerts, and scanners with an IBKR integration path and audit lineage — so income trades stay tied to what you actually own."
  },
  {
    title: "Multi-tenant admin",
    description:
      "Tenant provisioning, branding, role-based access, and compliance controls — rare in point solutions that stop at chat or read-only dashboards."
  },
  {
    title: "Production-scale stack",
    description:
      "Custom DB integrations and deployment at scale (Next.js + Spring + Mongo + ShedLock schedulers) — built for repeatability, not demoware."
  }
];

export const XFINANCE_PREMIUM_POSITIONING =
  "Closer to Bloomberg Terminal + OptionStrat + Orion + a custom AI strategist in one modern, auditable platform — but purpose-built for options income on real HNWI portfolios, not institutional data terminals you never fully use.";

export const XFINANCE_PREMIUM_TIME_VALUE = {
  audience: "Typical HNWI Investment Advisor ($50–300M AUM)",
  manualEffort:
    "Manual options research and scenario modeling on a complex book: 4–10+ hours/week.",
  compressed:
    "xFinance compresses that to minutes — conversational preflight → validated strategy job → payoff preview → audit log.",
  roi: "One well-executed covered-call or wheel overlay on a $5M+ client position can generate thousands in incremental income — easily covering months of subscription while improving retention and referrals."
} as const;

export const XFINANCE_PREMIUM_ILLUSTRATIVE_NOTE =
  "Illustrative desk math for planning conversations — not a guarantee of outcomes, time savings, or premium collected.";
