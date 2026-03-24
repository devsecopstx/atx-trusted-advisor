import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Legal routes", () => {
  const pagePath = path.join(process.cwd(), "src/app/legal/[slug]/page.tsx");
  const pageSource = readFileSync(pagePath, "utf8");

  it("includes all legal slugs in static params and title mapping", () => {
    expect(pageSource).toContain('"imprint"');
    expect(pageSource).toContain('"security"');
    expect(pageSource).toContain('"privacy"');
    expect(pageSource).toContain('"terms"');
    expect(pageSource).toContain('"vulnerability"');
    expect(pageSource).toContain('imprint: "Imprint"');
    expect(pageSource).toContain('security: "Security"');
    expect(pageSource).toContain('privacy: "Privacy Policy"');
    expect(pageSource).toContain('terms: "Terms of Service"');
    expect(pageSource).toContain('vulnerability: "Report a vulnerability"');
  });

  it("maps each legal slug to dedicated default content", () => {
    expect(pageSource).toContain("LegalImprintContent");
    expect(pageSource).toContain("LegalSecurityContent");
    expect(pageSource).toContain("LegalPrivacyContent");
    expect(pageSource).toContain("LegalTermsContent");
    expect(pageSource).toContain("LegalVulnerabilityContent");
    expect(pageSource).toContain("CONTENT_BY_SLUG");
  });

  it("does not render a generic legal placeholder body", () => {
    expect(pageSource).not.toContain("summary placeholder for early releases");
    expect(pageSource).not.toContain("legal-stub-body");
  });
});
