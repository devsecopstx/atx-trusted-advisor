import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";

export type ResourceGuideLink = {
  readonly href: string;
  readonly title: string;
  readonly description: string;
};

/** Panel header icon — maps to glyphs in `resource-guides-hub-icons.tsx`. */
export type ResourceGuideSectionIcon = "platform" | "xchat" | "wheel" | "playbooks";

/** Visual group on `/resources/guides` — panels roll up under group headers. */
export type ResourceGuideGroupId = "foundation" | "prompts" | "income" | "library";

export type ResourceGuideGroup = {
  readonly id: ResourceGuideGroupId;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
};

export type ResourceGuideSection = {
  readonly id: string;
  /** Jump-link chip label (short). */
  readonly shortLabel: string;
  readonly heading: string;
  /** Panel intro — product names per branding agent (xFinance, xChat, xOptions). */
  readonly subtitle: string;
  readonly icon: ResourceGuideSectionIcon;
  readonly group: ResourceGuideGroupId;
  readonly links: readonly ResourceGuideLink[];
};

/** Ordered panel groups for the guides hub layout. */
export const RESOURCE_GUIDE_GROUPS: readonly ResourceGuideGroup[] = [
  {
    id: "foundation",
    eyebrow: "Start here",
    title: "Platform foundation",
    description:
      "Onboarding, workspace posture, and how xFinance, xChat, and xOptions fit together for HNWI desks."
  },
  {
    id: "prompts",
    eyebrow: "Copy & paste",
    title: "xChat prompt libraries",
    description:
      "Production-grade prompts for income playbooks and quant tail-risk — paste into xChat, review before Send."
  },
  {
    id: "income",
    eyebrow: "Defined risk",
    title: "Wheel & income mechanics",
    description: "Wheel cadence and range-trade comparisons before you size chains in xOptions."
  },
  {
    id: "library",
    eyebrow: "Long reads",
    title: "Playbooks & deep dives",
    description: "CSPs, covered calls, LEAP overlays, multi-book posture, and xChat → broker handoff."
  }
];

/** Single hub for workspace / rail “Guides” — keep in sync when adding `/resources/*` articles. */
export const RESOURCE_GUIDE_SECTIONS: readonly ResourceGuideSection[] = [
  {
    id: "platform",
    shortLabel: "Platform",
    heading: "Platform overview",
    subtitle:
      "What xFinance delivers for Austin HNWI investors and advisors — xChat + xOptions + portfolio desk, multi-tenant admin, and the onboarding path from book setup to validated strategy jobs.",
    icon: "platform",
    group: "foundation",
    links: [
      {
        href: "/resources/onboarding-checklist",
        title: "Institutional onboarding",
        description:
          "Seven HNWI foundations: capital architecture, conviction watchlist, posture, IBKR parity, xAI advisory, validation, institutional workspace."
      },
      {
        href: "/resources/about",
        title: "About aTx Trusted Advisory",
        description: "HNW positioning, dashboard benefits, and what the platform covers."
      },
      {
        href: "/resources/decision-workflow",
        title: "Decision workflow",
        description: "Discover → manage and refine — how to run decisions on the platform."
      },
      {
        href: "/resources/secret-sauce",
        title: "Secret sauce",
        description: "Personas, collections, governance, and how the advisory stack fits together."
      },
      {
        href: "/resources/getting-started",
        title: "Getting started with options",
        description: "Onboarding, daily use, strategy patterns, and risk disclosures."
      }
    ]
  },
  {
    id: "xchat",
    shortLabel: "xChat",
    heading: "xChat",
    subtitle:
      "Prompt playbooks and conservative-to-aggressive templates you can paste into xChat — review before Send; educational only.",
    icon: "xchat",
    group: "prompts",
    links: [
      {
        href: "/resources/top-10-hnwi-xchat-prompts",
        title: "Top 10 HNWI xChat prompts",
        description: "Conservative, balanced, and aggressive playbooks you can use in xChat."
      },
      {
        href: "/resources/quant-trader-guide",
        title: "Quant Trader guide",
        description:
          "Monte Carlo tail-risk, Greeks exposure heatmaps, delta-scoped scans, and quant-trader xChat prompts."
      }
    ]
  },
  {
    id: "wheel",
    shortLabel: "Wheel & income",
    heading: "Wheel and income foundations",
    subtitle:
      "Wheel mechanics and when range structures fit — grounding before you lean on xOptions chains or desk sizing.",
    icon: "wheel",
    group: "income",
    links: [
      {
        href: "/resources/building-wheel",
        title: "Building a wheel",
        description: "Wheel income mechanics, cadence, and how we talk about risk."
      },
      {
        href: "/resources/building-wheel/wheel-vs-iron-condor",
        title: "Wheel vs Iron Condor",
        description: "When a wheel fits versus a defined-risk range trade."
      }
    ]
  },
  {
    id: "playbooks",
    shortLabel: "Playbooks",
    heading: "Playbooks and deep dives",
    subtitle:
      "Longer reads: CSPs, covered calls, LEAP overlays, multi-book posture, risk tiers, Grok wheel angles, and xChat → broker handoff.",
    icon: "playbooks",
    group: "library",
    links: ADVISORY_RESOURCE_PILLARS.map((p) => ({
      href: p.href,
      title: p.label,
      description: p.blurb
    }))
  }
];
