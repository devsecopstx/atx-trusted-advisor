import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/resources/onboarding-checklist page contract", () => {
  const pageSrc = readFileSync(
    join(process.cwd(), "src/app/resources/onboarding-checklist/page.tsx"),
    "utf8",
  );
  const clientSrc = readFileSync(
    join(process.cwd(), "src/app/resources/onboarding-checklist/onboarding-checklist-client.tsx"),
    "utf8",
  );
  const stepsSrc = readFileSync(
    join(process.cwd(), "src/lib/onboarding/onboarding-checklist-steps.ts"),
    "utf8",
  );

  it("declares canonical route and institutional onboarding shell", () => {
    expect(pageSrc).toContain('canonical: "/resources/onboarding-checklist"');
    expect(pageSrc).toContain("OnboardingChecklistClient");
    expect(clientSrc).toContain("Institutional onboarding foundations");
    expect(clientSrc).toContain("Private Client");
  });

  it("retains core onboarding section anchors and workspace CTAs", () => {
    for (const id of [
      "portfolio-foundation",
      "watchlist-curation",
      "risk-outlook",
      "broker-parity",
      "personalize",
      "final-validation",
      "expected-outcome",
    ]) {
      expect(stepsSrc).toContain(`id: "${id}"`);
    }
    expect(stepsSrc).toContain("Core Income portfolio");
    expect(stepsSrc).toContain("/import-activity");
    expect(stepsSrc).toContain("xchat_logs");
    expect(stepsSrc).toContain('href: "/xoptions"');
    expect(stepsSrc).toContain('href: "/portfolio"');
  });
});
