import Link from "next/link";
import { notFound } from "next/navigation";

const SLUGS = ["imprint", "security", "privacy", "vulnerability"] as const;
type LegalSlug = (typeof SLUGS)[number];

const TITLES: Record<LegalSlug, string> = {
  imprint: "Imprint",
  security: "Security",
  privacy: "Privacy",
  vulnerability: "Report a vulnerability"
};

const PLACEHOLDER =
  "This page is a placeholder. Replace with your legal, security, and disclosure content before production.";

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
  return (
    <div className="legal-stub-page">
      <p className="legal-stub-back">
        <Link href="/">← Back</Link>
      </p>
      <h1 className="legal-stub-title">{TITLES[key]}</h1>
      <p className="legal-stub-body">{PLACEHOLDER}</p>
    </div>
  );
}
