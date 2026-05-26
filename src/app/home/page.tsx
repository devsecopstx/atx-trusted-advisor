import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicMarketingLanding } from "@/app/ui/public-marketing-landing";
import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import { resolveGuestLandingVariantForRequest } from "@/lib/marketing/guest-landing-page";
import { XFINANCE_BRAND_SUBLINE } from "@/lib/xfinance-brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `aTx Trusted Advisory — ${XFINANCE_BRAND_SUBLINE}`,
  description: `${XFINANCE_BRAND_SUBLINE} Role-aware guest landing for HNWI retail and Investment Advisor firm desks. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/home"
  }
};

type HomeAliasPageProps = {
  searchParams: Promise<{ for?: string | string[] }>;
};

export default async function HomeAliasPage({ searchParams }: HomeAliasPageProps) {
  const session = await getSessionUser();
  if (session) {
    redirect(await resolveSessionLandingPath(session));
  }

  const sp = await searchParams;
  const forRaw = typeof sp.for === "string" ? sp.for : Array.isArray(sp.for) ? sp.for[0] : undefined;
  const variant = await resolveGuestLandingVariantForRequest({ session: null, forQuery: forRaw });

  return <PublicMarketingLanding variant={variant} />;
}
