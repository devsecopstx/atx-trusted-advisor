import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicMarketingLanding } from "@/app/ui/public-marketing-landing";
import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "aTx Trusted Advisory — AI Co-Pilot for Options Income & Portfolio Defense",
  description: `HNWI-grade workspace for covered calls, wheels, and iron condors — real portfolio integration, desk alerts, strategy jobs, and Grok-backed xChat. RIAs and family offices: tenant branding and white-label-ready portals. ${EDUCATIONAL_ONLY_SHORT}`,
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
