import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalPrivacyContent, LegalTermsContent } from "@/app/legal/legal-default-content";

const SLUGS = ["imprint", "security", "privacy", "terms", "vulnerability"] as const;
type LegalSlug = (typeof SLUGS)[number];

const TITLES: Record<LegalSlug, string> = {
  imprint: "Imprint",
  security: "Security",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  vulnerability: "Report a vulnerability"
};

const PLACEHOLDER =
  "This page is a summary placeholder for early releases. Have qualified counsel review entity details, jurisdiction, and disclosures before relying on it in regulated contexts.";

type PageProps = {
  params: Promise<{ slug: string }>;
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

  const body =
    key === "privacy" ? (
      <LegalPrivacyContent />
    ) : key === "terms" ? (
      <LegalTermsContent />
    ) : (
      <p className="legal-stub-body">{PLACEHOLDER}</p>
    );

  return (
    <div className="legal-stub-page">
      <p className="legal-stub-back">
        <Link href="/">← Back</Link>
      </p>
      <h1 className="legal-stub-title">{TITLES[key]}</h1>
      {body}
    </div>
  );
}
