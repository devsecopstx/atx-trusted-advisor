import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import {
    LegalImprintContent,
    LegalPrivacyContent,
    LegalSecurityContent,
    LegalTermsContent,
    LegalVulnerabilityContent
} from "@/app/legal/legal-default-content";
import {
    AppUserAccountPublicRailForSession
} from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";
import "../../xchat/xchat.css";

const SLUGS = ["imprint", "security", "privacy", "terms", "vulnerability"] as const;
type LegalSlug = (typeof SLUGS)[number];

const TITLES: Record<LegalSlug, string> = {
  imprint: "Imprint",
  security: "Security",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  vulnerability: "Report a vulnerability"
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

const CONTENT_BY_SLUG: Record<LegalSlug, ReactElement> = {
  imprint: <LegalImprintContent />,
  security: <LegalSecurityContent />,
  privacy: <LegalPrivacyContent />,
  terms: <LegalTermsContent />,
  vulnerability: <LegalVulnerabilityContent />
};

export function generateStaticParams(): { slug: LegalSlug }[] {
  return SLUGS.map((slug) => ({ slug }));
}

export default async function LegalSlugPage({ params }: PageProps) {
  const { slug } = await params;
  if (!SLUGS.includes(slug as LegalSlug)) {
    notFound();
  }
  const key = slug as LegalSlug;
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const legalDoc = (
    <article className="legal-stub-page" aria-label={`${TITLES[key]} agreement`}>
      <p className="legal-stub-back">
        <Link href="/">← Back</Link>
      </p>
      <h1 className="legal-stub-title">{TITLES[key]}</h1>
      {CONTENT_BY_SLUG[key]}
    </article>
  );

  if (session && approved) {
    return (
      <div className="xchat-shell">
        <AppUserApprovedHeader current="xchat" feedbackPageLabel={`Legal · ${TITLES[key]}`} session={session} />
        <div className="xchat-body" style={{ padding: "1rem" }}>
          <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
            {legalDoc}
            <GlobalFooter />
          </AppUserCollapsibleRailLayout>
        </div>
      </div>
    );
  }

  return (
    <div className="xchat-shell">
      <XchatGuestHeader />
      <div className="xchat-body" style={{ padding: "1rem" }}>
        {legalDoc}
        <GlobalFooter />
      </div>
    </div>
  );
}
