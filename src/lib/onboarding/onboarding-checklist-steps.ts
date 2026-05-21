export type OnboardingChecklistAction = {
  label: string;
  detail: string;
};

export type OnboardingChecklistCta = {
  href: string;
  label: string;
  seedPrompt?: string;
  personaName?: string;
};

export type OnboardingChecklistStep = {
  id: string;
  navLabel: string;
  number: number;
  title: string;
  description: string;
  familyOfficeNote: string;
  actions: OnboardingChecklistAction[];
  impactLine: string;
  cta: OnboardingChecklistCta;
};

export const ONBOARDING_CHECKLIST_STEP_IDS = [
  "portfolio-foundation",
  "watchlist-curation",
  "risk-outlook",
  "broker-parity",
  "personalize",
  "final-validation",
  "expected-outcome",
] as const;

export type OnboardingChecklistStepId = (typeof ONBOARDING_CHECKLIST_STEP_IDS)[number];

export const ONBOARDING_CHECKLIST_TOTAL_STEPS = ONBOARDING_CHECKLIST_STEP_IDS.length;

export const ONBOARDING_CHECKLIST_ESTIMATED_MINUTES = 18;

export const ONBOARDING_CHECKLIST_STEPS: OnboardingChecklistStep[] = [
  {
    id: "portfolio-foundation",
    navLabel: "1 · Architecture",
    number: 1,
    title: "Capital architecture & lot-level integrity",
    description:
      "Institutional-grade recommendations begin with a consolidated book of record — every sleeve, custodian account, open lot, and cash balance the advisory layer can trust.",
    familyOfficeNote:
      "Multi-custodian visibility and lot-level cost-basis integrity are non-negotiable for tax-aware overlays, estate sleeves, and conviction-weighted allocation across generations.",
    actions: [
      {
        label: "Designate primary portfolio sleeves",
        detail:
          "Structure books by mandate — Core Income, Growth Alpha, charitable remainder, taxable vs qualified — each tracked independently with lot-level cost basis.",
      },
      {
        label: "Import or reconcile every account",
        detail:
          "Broker CSV upload via /import-activity (Merrill, Fidelity, Schwab, and others) builds consolidated holdings with Avg cost vs Last for reconciliation.",
      },
      {
        label: "Establish IBKR Client Portal parity",
        detail:
          "Connect IBKR for sealed-session readiness — consent plus entitled accounts surface positions, cash, and margin for live capital deployment paths.",
      },
      {
        label: "Verify consolidated holdings",
        detail:
          "Confirm cash balances, open positions, average costs, and day P&L in Portfolio → Edit Account before activating options overlays.",
      },
    ],
    impactLine:
      "Covered calls, cash-secured puts, collars, and wheel workflows only align with your capital when the engine sees real positions — otherwise even xAI-orchestrated synthesis stays theoretical.",
    cta: { href: "/portfolio", label: "Open portfolio architecture" },
  },
  {
    id: "watchlist-curation",
    navLabel: "2 · Conviction",
    number: 2,
    title: "Conviction-weighted watchlist curation",
    description:
      "Your high-conviction universe seeds symbol-scoped discovery, IV/OI context, and the xOptions overlay engine — not a generic ticker list.",
    familyOfficeNote:
      "Family offices rarely trade the full market; they steward a curated opportunity set. The watchlist encodes that discipline for every downstream scanner and multi-agent briefing.",
    actions: [
      {
        label: "Build the core opportunity set",
        detail:
          "Add all material holdings plus 10–20 conviction names — earnings catalysts, event-driven ideas, and liquidity-aware names your desk actually trades.",
      },
      {
        label: "Set price and desk alerts",
        detail:
          "Configure alerts on key levels so scheduled scanners and portfolio alerts surface opportunities when your posture allows action.",
      },
      {
        label: "Align rail context with xOptions",
        detail:
          "Compact watchlist and hot IV/OI rows feed xOptions Step 1 (Find Options) and xAI multi-agent workspace preload — one curated universe, every surface.",
      },
    ],
    impactLine:
      "Conviction-weighted alpha capture starts here: the platform prioritizes what you care about, not what happens to be trending.",
    cta: { href: "/watchlist", label: "Curate watchlist" },
  },
  {
    id: "risk-outlook",
    navLabel: "3 · Posture",
    number: 3,
    title: "Risk tolerance & investment outlook profiling",
    description:
      "Explicit posture — conservative income, balanced theta, aggressive directional — seeds the entire xStrategyBuilder engine and StrategyJob scoring paths.",
    familyOfficeNote:
      "Wealth-preservation mandates, liquidity gates, and generational time horizons must be stated once and enforced everywhere. Ambiguous posture produces generic output unworthy of fiduciary review.",
    actions: [
      {
        label: "Declare risk tolerance in xChat",
        detail:
          "State conservative defined-risk income, balanced theta with mild delta, or aggressive directional/vol-selling — only where role and broker approvals permit.",
      },
      {
        label: "Anchor market outlook and horizon",
        detail:
          "Bullish, range-bound, bearish, event-driven, or vol-crush — plus time horizon, max notional per structure, preferred DTE bands, and tax or liquidity constraints.",
      },
      {
        label: "Sync options strategy preferences",
        detail:
          "Mongo-backed strategy catalog (aligned with coreskills xPersonas) plus your chosen xChat persona anchor signals into OptionsStrategyEngine scoring.",
      },
      {
        label: "Confirm persona routing",
        detail:
          "Preflight → slot collection → synthesize becomes surgical when workspace data and posture are complete — StrategyJob-class flows inherit your stated mandate.",
      },
    ],
    impactLine:
      "Your stated posture becomes the guardrail layer: every recommendation inherits the same risk bucket your IC would expect on a Monday morning brief.",
    cta: {
      href: "/xchat",
      label: "Define posture in xChat",
      seedPrompt:
        "Document my risk tolerance (conservative defined-risk income), market outlook, time horizon, max notional per options structure, preferred DTE bands, and any tax or liquidity constraints for this portfolio sleeve.",
      personaName: "finance-advisor",
    },
  },
  {
    id: "broker-parity",
    navLabel: "4 · Custody",
    number: 4,
    title: "Multi-custodian parity & IBKR sealed-session readiness",
    description:
      "Custodian identity, import cadence, and live session health must match the broker of record — desk views and execution parity depend on it.",
    familyOfficeNote:
      "Regulatory-readiness and audit defensibility require that platform snapshots reconcile to source custodians. Stale or mis-mapped accounts undermine every downstream Greek and margin calculation.",
    actions: [
      {
        label: "Map external account identifiers",
        detail:
          "Update ext account id and related desk fields so each portfolio account syncs to the correct custodian row across imports and linked snapshots.",
      },
      {
        label: "Refresh broker imports on cadence",
        detail:
          "Re-run broker CSV import when activity changes; use consolidated holdings and import previews to reconcile against the custodian export of record.",
      },
      {
        label: "Validate IBKR Client Portal session",
        detail:
          "Where IBKR is linked, refresh consent and sealed session if snapshots look stale — positions, cash, and margin must mirror Client Portal for live deployment.",
      },
      {
        label: "Reconcile before options activation",
        detail:
          "IBKR-sealed execution parity is the bar for deploying overlays on entitled accounts — never trade against a book the platform has not verified.",
      },
    ],
    impactLine:
      "Multi-custodian families cannot afford shadow positions; parity here is the difference between advisory confidence and reconciliation fire drills.",
    cta: { href: "/account/integrations/ibkr", label: "Review IBKR integration" },
  },
  {
    id: "personalize",
    navLabel: "5 · Advisory",
    number: 5,
    title: "xAI advisory layer & options-overlay activation",
    description:
      "Activate the multi-agent advisory layer and options-overlay engine — conversation continuity, structure-heavy personas, and a full xOptions builder pass.",
    familyOfficeNote:
      "Sophisticated capital stewards expect memory, auditability, and structure-aware routing — not stateless chat. Personalization converts generic LLM output into institution-grade synthesis.",
    actions: [
      {
        label: "Enable conversation continuity",
        detail:
          "Opt in to xChat history when available — turns persist in Mongo xchat_logs with product-enforced rolling retention for session continuity across devices.",
      },
      {
        label: "Select structure-aware persona routing",
        detail:
          "Use the options-strategy persona or hardcore strategy path for structure-heavy asks — RAG plus OptionsStrategyEngine scoring where configured.",
      },
      {
        label: "Complete one xOptions builder flow",
        detail:
          "Run a full stepped builder on /xoptions — Step 1 bootstrap pulls portfolio and watchlist context and seeds later StrategyJob workflows.",
      },
      {
        label: "Brief the multi-agent layer",
        detail:
          "xAI-orchestrated multi-agent synthesis performs best when portfolio, watchlist, posture, and persona are already aligned from steps 1–4.",
      },
    ],
    impactLine:
      "This is where the workspace shifts from read-only intelligence to actionable, context-aware options overlay design.",
    cta: { href: "/xoptions", label: "Launch xOptions builder" },
  },
  {
    id: "final-validation",
    navLabel: "6 · Validate",
    number: 6,
    title: "Cross-check against live P&L, Greeks, and margin",
    description:
      "Prove the stack end-to-end: trigger a scheduler tick or StrategyJob, then inspect outputs as you would a desk review before capital deployment.",
    familyOfficeNote:
      "Audit-logged validation is how family offices separate research from commitment. Review payoff geometry, real-time Greeks exposure, and margin impact before any overlay goes live.",
    actions: [
      {
        label: "Trigger execution path",
        detail:
          "Operator manual scheduler tick (Admin → Tasks for global_admin; /workspace/tasks when configured) or start a StrategyJob from xChat with a portfolio-scoped scan prompt.",
      },
      {
        label: "Review strategy outputs",
        detail:
          "Inspect strategy cards, Apex payoff charts, Greeks, and risk/outlook tags — confirm they match your book and the posture stated in step 3.",
      },
      {
        label: "Iterate with audit trail",
        detail:
          "Admin audit trail (Admin → Audit) plus tenant xChat debug logging (Admin → Tenant workspace, when enabled) support refinement without guesswork.",
      },
      {
        label: "Sign off before deployment",
        detail:
          "Treat validation like an IC memo: if outputs disagree with custodian records or stated mandate, resolve parity before proceeding.",
      },
    ],
    impactLine:
      "Validation converts configured infrastructure into trusted, deployable intelligence — the last gate before live options overlay.",
    cta: {
      href: "/xchat",
      label: "Run validation scan in xChat",
      seedPrompt:
        "Run full options strategy scan on my Core Income portfolio using balanced outlook with 2-week horizon.",
    },
  },
  {
    id: "expected-outcome",
    navLabel: "Outcome",
    number: 7,
    title: "Fully personalized, audit-logged institutional recommendations",
    description:
      "With all foundations complete, the workspace delivers production-grade, xAI-augmented guidance grounded in your actual capital — not generic suggestions.",
    familyOfficeNote:
      "Legacy-integrated wealth demands that recommendations respect verified books, stated mandates, and audit trails. This is the operating standard for multi-generational stewardship.",
    actions: [
      {
        label: "Portfolio-grounded synthesis",
        detail:
          "Recommendations respect verified consolidated holdings, accounts, and imports — lot-level integrity flows into every structure proposal.",
      },
      {
        label: "Risk-bucket alignment",
        detail:
          "Conservative, balanced, or aggressive scoring paths mirror the posture you documented — no silent drift across sessions.",
      },
      {
        label: "Full stack engagement",
        detail:
          "RAG-linked options coreskills plus OptionsStrategyEngine scoring, real-time Greeks exposure, and xOptions strategy builder operate as one institution-grade layer.",
      },
      {
        label: "Consolidated family-office view",
        detail:
          "Multi-sleeve visibility, IBKR execution parity where linked, and xAI multi-agent advisory — unified in a single audited workspace.",
      },
    ],
    impactLine:
      "The moment generic suggestions end and your institutional workspace begins — every surface speaks the language of your book.",
    cta: { href: "/xchat", label: "Enter your institutional workspace" },
  },
];

export function getOnboardingStepIndex(stepId: OnboardingChecklistStepId): number {
  return ONBOARDING_CHECKLIST_STEP_IDS.indexOf(stepId);
}

export function getNextOnboardingStep(
  stepId: OnboardingChecklistStepId,
): OnboardingChecklistStep | null {
  const index = getOnboardingStepIndex(stepId);
  if (index < 0 || index >= ONBOARDING_CHECKLIST_STEPS.length - 1) {
    return null;
  }
  return ONBOARDING_CHECKLIST_STEPS[index + 1] ?? null;
}
