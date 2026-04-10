import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicMarketingLanding } from "@/app/ui/public-marketing-landing";
import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "aTx Trusted Advisory — xAI-Powered Family Portfolio Intelligence",
  description: `One private workspace: portfolio consolidation, Grok-backed xChat, and xOptions strategy tools for Austin HNW families and advisors. ${EDUCATIONAL_ONLY_SHORT}`
};

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) {
    const landing = await resolveSessionLandingPath(session);
    redirect(landing);
  }

  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;

  return <PublicMarketingLanding googleLoginHref={googleLoginHref} />;
}
