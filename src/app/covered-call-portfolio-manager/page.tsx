import { SeoSolutionLanding } from "@/app/ui/seo-solution-landing";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Covered Call Portfolio Manager | aTx Trusted Advisory",
  description: `Manage covered-call overlays against live holdings with workspace-wide context, income framing, and xChat guardrails. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/covered-call-portfolio-manager"
  }
};

const BULLETS = [
  "Holdings-linked views so short-call overlays align with actual inventory and accounts.",
  "xChat personas and tools stay inside tenant boundaries — viewer, operator, and advisor roles.",
  "Balanced-income frameworks and LEAP overlays tie educational content to desk workflows."
] as const;

export default function CoveredCallPortfolioManagerPage() {
  return (
    <SeoSolutionLanding
      h1="Covered Call Portfolio Manager"
      lead="Run covered calls as a portfolio discipline: inventory-aware charts, premium targets, and Grok-assisted reviews when your tenant turns them on."
      bullets={BULLETS}
      primaryResourceHref="/resources/covered-calls-2026-balanced-income"
      primaryResourceLabel="Covered calls 2026 guide"
    />
  );
}
