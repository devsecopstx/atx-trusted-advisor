import { SeoSolutionLanding } from "@/app/ui/seo-solution-landing";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RIA White Label Platform | aTx Trusted Advisory",
  description: `Tenant-branded workspaces, segregated data, YAML provisioning, and professional roles for RIAs and family offices. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/ria-white-label-platform"
  }
};

const BULLETS = [
  "White-label-ready portals with branding and workspace isolation per tenant.",
  "Roles: viewer, operator, advisor — mapped to how desks actually delegate access.",
  "Pilot-friendly provisioning patterns (including YAML-driven specs) for repeatable rollouts."
] as const;

export default function RiaWhiteLabelPlatformPage() {
  return (
    <SeoSolutionLanding
      h1="RIA White Label Platform"
      lead="Deploy co-branded client and operator workspaces with governance-minded defaults — contracts, compliance review, and enabled features apply per pilot."
      bullets={BULLETS}
      primaryResourceHref="/resources/multi-portfolio-management-hnwi"
      primaryResourceLabel="Multi-portfolio HNWI overview"
    />
  );
}
