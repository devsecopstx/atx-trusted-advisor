import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Legal routes", () => {
  const pagePath = path.join(process.cwd(), "src/app/legal/[slug]/page.tsx");
  const pageSource = readFileSync(pagePath, "utf8");

  it("includes privacy and terms in static slugs", () => {
    expect(pageSource).toContain('"privacy"');
    expect(pageSource).toContain('"terms"');
    expect(pageSource).toContain("LegalPrivacyContent");
    expect(pageSource).toContain("LegalTermsContent");
  });
});
