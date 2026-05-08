import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicMarketingLanding } from "@/app/ui/public-marketing-landing";
import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "aTx Trusted Advisory — Real-Money Options Income & Grok-Backed Portfolio Context",
  description: `Real-money options income with AI that understands your book — wheels, covered calls, CSPs, and LEAP overlays with portfolio context, risk guardrails, and audit trails. Enterprise-grade tenant isolation; white-label portals for RIAs and family offices. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/"
  }
};

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) {
    const landing = await resolveSessionLandingPath(session);
    redirect(landing);
  }

  return <PublicMarketingLanding />;
}
