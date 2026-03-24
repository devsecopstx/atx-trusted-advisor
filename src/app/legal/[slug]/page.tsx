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

  return (
    <div className="legal-stub-page">
      <p className="legal-stub-back">
        <Link href="/">← Back</Link>
      </p>
      <h1 className="legal-stub-title">{TITLES[key]}</h1>
      {CONTENT_BY_SLUG[key]}
    </div>
  );
}
