import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/resources/onboarding-checklist page contract", () => {
  const pageSrc = readFileSync(
    join(process.cwd(), "src/app/resources/onboarding-checklist/page.tsx"),
    "utf8"
  );

  it("declares canonical route and core onboarding anchors", () => {
    expect(pageSrc).toContain('canonical: "/resources/onboarding-checklist"');
    expect(pageSrc).toContain('id="portfolio-foundation"');
    expect(pageSrc).toContain('id="watchlist-curation"');
    expect(pageSrc).toContain('id="risk-outlook"');
    expect(pageSrc).toContain('id="broker-parity"');
    expect(pageSrc).toContain('id="personalize"');
    expect(pageSrc).toContain('id="final-validation"');
    expect(pageSrc).toContain('id="expected-outcome"');
    expect(pageSrc).toContain('{ id: "expected-outcome", label: "Outcome" }');
    expect(pageSrc).toContain("Core Income portfolio");
    expect(pageSrc).toContain('href="/import-activity"');
    expect(pageSrc).toContain('xchat_logs');
  });
});
