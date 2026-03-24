export type FollowUpQuestion = {
  id: string;
  prompt: string;
  /** Smaller context line (e.g. baseline timing). */
  hint?: string;
  /** Optional sub-prompts (checkboxes are per main question + notes). */
  subBullets?: string[];
};

export type FollowUpSection = {
  id: string;
  title: string;
  intro?: string;
  questions: FollowUpQuestion[];
};

export const FOLLOW_UP_INTRO =
  "Filtered & prioritized assuming time savings is the #1 pain point for HNWI / family office. Questions are direct, assumptive where you have already answered internally, and focused on validation + next actions.";

export const FOLLOW_UP_SECTIONS: FollowUpSection[] = [
  {
    id: "baseline",
    title: "Time validation & current baseline",
    questions: [
      {
        id: "weekly-time",
        prompt:
          "How much time do you (or your family office / clients) currently spend each week monitoring or managing options positions and income strategies?",
        hint: "Your baseline: ~1 hr 30 min Monday export/review + 15 min Tuesday order entry ≈ ~1 hr 45 min/week — we're targeting <60 min total.",
      },
    ],
  },
  {
    id: "value",
    title: "Perceived value of time reduction",
    questions: [
      {
        id: "value-prop",
        prompt:
          "If a tool delivered 1–2 vetted, ITM-focused trade ideas per week (with full rationale, position sizing, risk flags, and ready-to-approve order previews) and reduced your weekly involvement to under an hour — would that feel meaningfully valuable for maintaining 1–2% weekly profits on autopilot?",
      },
    ],
  },
  {
    id: "feature",
    title: "Feature that closes the deal",
    questions: [
      {
        id: "killer-feature",
        prompt:
          'If we demo this next week, what single feature would make you say "yes" immediately — for example:',
        subBullets: [
          "Seamless Monday export/import of holdings & activities?",
          "One-click Tuesday order submission (hassle-free ITM puts/calls)?",
          "Real-time alerts only when action is truly needed?",
          "Multi-account / family office portfolio sync?",
        ],
      },
    ],
  },
  {
    id: "distribution",
    title: "Business & distribution preference",
    questions: [
      {
        id: "b2b-vs-b2c",
        prompt: "For your use case (family office / personal HNWI management), would you prefer:",
        subBullets: [
          "B2B white-label licensing so it integrates under your family office branding and control, or",
          "Straight individual subscription access for yourself / key advisors?",
        ],
      },
    ],
  },
  {
    id: "integrations",
    title: "Must-have integrations & guardrails",
    questions: [
      {
        id: "brokers",
        prompt:
          "Beyond E*TRADE, which broker(s) or data feeds are non-negotiable for you (Fidelity, Schwab, Interactive Brokers, real-time Yahoo / others)?",
      },
      {
        id: "compliance",
        prompt:
          "On the compliance side: what specific audit logs, export formats, data privacy rules, or terms/disclaimers do we need to bake in from day one so this fits family office / trusted-family standards?",
      },
    ],
  },
];
