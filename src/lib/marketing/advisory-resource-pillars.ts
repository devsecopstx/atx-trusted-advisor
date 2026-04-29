export type AdvisoryResourcePillar = {
  readonly href: string;
  readonly label: string;
  readonly blurb: string;
};

/** Eight educational resource articles — landing `#resources-pillars` and `/resources/about` index. */
export const ADVISORY_RESOURCE_PILLARS: readonly AdvisoryResourcePillar[] = [
  {
    href: "/resources/2026-options-income-playbook",
    label: "2026 options income playbook",
    blurb: "Income themes and playbook framing for the year ahead."
  },
  {
    href: "/resources/how-xai-spots-better-wheels",
    label: "Grok wheel edge",
    blurb: "How xAI evaluates wheel-style setups vs. typical human blind spots."
  },
  {
    href: "/resources/cash-secured-puts-mastery",
    label: "CSP mastery (HNWI)",
    blurb: "Cash-secured puts as the conservative foundation for income books."
  },
  {
    href: "/resources/covered-calls-2026-balanced-income",
    label: "Covered calls 2026",
    blurb: "Balanced premium on stock you already own — without forced exits."
  },
  {
    href: "/resources/leap-options-playbook",
    label: "LEAP playbook",
    blurb: "Long-dated leverage plus short-cycle income overlays."
  },
  {
    href: "/resources/multi-portfolio-management-hnwi",
    label: "Multi-portfolio HNWI",
    blurb: "Multiple books, scoped workspace, and tenant-grade data posture."
  },
  {
    href: "/resources/options-risk-management-frameworks",
    label: "Risk frameworks",
    blurb: "Conservative, balanced, and aggressive tiers with xAI guardrails."
  },
  {
    href: "/resources/from-xchat-to-broker-ibkr",
    label: "xChat → IBKR",
    blurb: "From prompts to structured workflows, snapshots, and audit trails."
  }
];
