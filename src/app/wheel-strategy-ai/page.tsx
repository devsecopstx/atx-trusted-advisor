import { SeoSolutionLanding } from "@/app/ui/seo-solution-landing";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wheel Strategy AI | aTx Trusted Advisory",
  description: `Wheel-style income workflows with Grok-backed xChat, portfolio context, and risk guardrails on approved tenants. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/wheel-strategy-ai"
  }
};

const BULLETS = [
  "Cash-secured puts and covered-call cadence with book-aware prompts — not generic chat.",
  "Desk alerts, watchlist context, and tenant-scoped tools when your workspace enables them.",
  "Educational pillars and playbooks map directly to how wheels are operated in production books."
] as const;

export default function WheelStrategyAiPage() {
  return (
    <SeoSolutionLanding
      h1="Wheel Strategy AI"
      lead="Combine systematic wheel mechanics with Grok-backed reasoning scoped to your portfolios — tenant-safe, role-aware, and built for operators who document decisions."
      bullets={BULLETS}
      primaryResourceHref="/resources/building-wheel"
      primaryResourceLabel="Read the wheel playbook"
    />
  );
}
