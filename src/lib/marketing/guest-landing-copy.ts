import { buildGuestTrialXOAuthLoginHref } from "@/lib/marketing/guest-trial-auth";
import type { GuestLandingVariant } from "@/lib/marketing/guest-landing-variant";

export type GuestLandingHeroCopy = {
  eyebrow: string;
  headline: string;
  lead: string;
  bulletOneLabel: string;
  bulletOneBody: string;
  bulletTwoLabel: string;
  bulletTwoBody: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  tertiaryCtaLabel?: string;
  tertiaryCtaHref?: string;
  footerLine: string;
};

export const GUEST_LANDING_HERO_COPY: Record<GuestLandingVariant, GuestLandingHeroCopy> = {
  hnwi: {
    eyebrow: "Austin HNWI · real-money income",
    headline: "Options income on the book you already own",
    lead: "Wheels, covered calls, cash-secured puts, and conservative income sleeves — grounded in portfolio import, desk guardrails, and an xOptions demo before you commit capital.",
    bulletOneLabel: "xChat + RAG",
    bulletOneBody:
      "Grok playbooks for wheels, covered calls, and defined-risk income tied to your holdings.",
    bulletTwoLabel: "xOptions + desk",
    bulletTwoBody:
      "Chain glance, strategy builder, and scanners with portfolio context (educational; not execution advice).",
    primaryCtaLabel: "Start 30-Day Free Trial",
    primaryCtaHref: buildGuestTrialXOAuthLoginHref("/xchat"),
    secondaryCtaLabel: "Start free scan",
    secondaryCtaHref: "/xoptions",
    tertiaryCtaLabel: "Explore xOptions demo",
    tertiaryCtaHref: "/xoptions",
    footerLine:
      "30-day trial: basic operator · xChat + xOptions + portfolio desk at plan limits — no card for trial start."
  },
  advisor: {
    eyebrow: "Investment Advisors & firm desks",
    headline: "Multi-book ops with compliance-ready audit",
    lead: "Client portfolios, team xChat, tenant provisioning, and governance-minded defaults — built for reps and firms who need repeatability without a custom dev shop.",
    bulletOneLabel: "Client books",
    bulletOneBody:
      "Segregated portfolios, operator/advisor/viewer roles, and YAML-friendly tenant bootstrap.",
    bulletTwoLabel: "Governance",
    bulletTwoBody:
      "Persona governance, team xChat, and compliance export paths on approved workspaces.",
    primaryCtaLabel: "Start 30-Day Free Trial",
    primaryCtaHref: buildGuestTrialXOAuthLoginHref("/xchat"),
    secondaryCtaLabel: "Book demo",
    secondaryCtaHref: "/growth",
    tertiaryCtaLabel: "IA white-label overview",
    tertiaryCtaHref: "/ia-white-label-platform",
    footerLine:
      "Trial starts as basic operator on your default tenant — upgrade or request firm provisioning when the window ends."
  }
};
