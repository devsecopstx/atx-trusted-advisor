import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicMarketingLanding } from "@/app/ui/public-marketing-landing";
import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "aTx Trusted Advisory — Options Income in 30–60 Minutes a Week",
  description: `Generate consistent options income with minimal time: AI-curated wheel, covered calls, and LEAP workflows. Portfolios, Grok-backed xChat, and xOptions in one workspace. ${EDUCATIONAL_ONLY_SHORT}`
};

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) {
    const landing = await resolveSessionLandingPath(session);
    redirect(landing);
  }

  return <PublicMarketingLanding />;
}
