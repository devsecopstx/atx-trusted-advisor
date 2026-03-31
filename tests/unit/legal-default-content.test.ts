import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("legal default content", () => {
  const contentPath = path.join(process.cwd(), "src/app/legal/legal-default-content.tsx");
  const source = readFileSync(contentPath, "utf8");

  it("ships dedicated defaults for all legal pages", () => {
    expect(source).toContain("export function LegalImprintContent()");
    expect(source).toContain("export function LegalSecurityContent()");
    expect(source).toContain("export function LegalPrivacyContent()");
    expect(source).toContain("export function LegalTermsContent()");
    expect(source).toContain("export function LegalVulnerabilityContent()");
  });

  it("includes release-safe sections for imprint, security, and vulnerability pages", () => {
    expect(source).toContain("Service provider");
    expect(source).toContain("Regulatory and professional use");
    expect(source).toContain("Security program");
    expect(source).toContain("Shared responsibility");
    expect(source).toContain("Responsible disclosure expectations");
    expect(source).toContain("Safe harbor intent");
  });

  it("keeps baseline policy sections for privacy and terms", () => {
    expect(source).toContain("Who we are");
    expect(source).toContain("AI and automated processing");
    expect(source).toContain("Not Financial, Legal, or Tax Advice");
    expect(source).toContain("Limitation of Liability");
  });
});
