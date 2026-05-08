import { SeoSolutionLanding } from "@/app/ui/seo-solution-landing";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IBKR Options Automation | aTx Trusted Advisory",
  description: `Broker-aligned workflows, snapshots, and strategy jobs for options operators — educational tooling on approved workspaces. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/ibkr-options-automation"
  }
};

const BULLETS = [
  "Structured path from xChat prompts to broker-linked snapshots and desk review — see our IBKR narrative.",
  "Strategy jobs and xOptions surfaces orchestrate heavy lifts when your stack enables the JVM worker.",
  "Automation stays subordinate to human approval; audit lineage matters for serious books."
] as const;

export default function IbkrOptionsAutomationPage() {
  return (
    <SeoSolutionLanding
      h1="IBKR Options Automation"
      lead="Position aTx as the advisory layer over Interactive Brokers-style workflows: imports, snapshots, and jobs — always gated by tenant policy and human sign-off."
      bullets={BULLETS}
      primaryResourceHref="/resources/from-xchat-to-broker-ibkr"
      primaryResourceLabel="From xChat to IBKR workflows"
    />
  );
}
