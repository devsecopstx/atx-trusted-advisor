import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";

export type ResourceGuideLink = {
  readonly href: string;
  readonly title: string;
  readonly description: string;
};

/** Panel header icon — maps to glyphs in `resource-guides-hub-panels.tsx`. */
export type ResourceGuideSectionIcon = "platform" | "xchat" | "wheel" | "playbooks";

export type ResourceGuideSection = {
  readonly id: string;
  /** Jump-link chip label (short). */
  readonly shortLabel: string;
  readonly heading: string;
  /** Panel intro — product names per branding agent (xFinance, xChat, xOptions). */
  readonly subtitle: string;
  readonly icon: ResourceGuideSectionIcon;
  readonly links: readonly ResourceGuideLink[];
};

/** Single hub for workspace / rail “Guides” — keep in sync when adding `/resources/*` articles. */
export const RESOURCE_GUIDE_SECTIONS: readonly ResourceGuideSection[] = [
  {
    id: "platform",
    shortLabel: "Platform",
    heading: "Platform overview",
    subtitle:
      "How aTx Trusted Advisory fits your book — dashboards, decision workflow, and the xFinance workspace alongside reporting and governance.",
    icon: "platform",
    links: [
      {
        href: "/resources/onboarding-checklist",
        title: "Onboarding checklist",
        description:
          "HNWI order of operations through validation: portfolio, watchlist, risk, broker parity, xChat/xOptions, StrategyJob test."
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
    links: [
      {
        href: "/resources/top-10-hnwi-xchat-prompts",
        title: "Top 10 HNWI xChat prompts",
        description: "Conservative, balanced, and aggressive playbooks you can use in xChat."
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
    links: ADVISORY_RESOURCE_PILLARS.map((p) => ({
      href: p.href,
      title: p.label,
      description: p.blurb
    }))
  }
];
