import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("GlobalFooter", () => {
  const footerPath = path.join(process.cwd(), "src/app/ui/global-footer.tsx");
  const source = readFileSync(footerPath, "utf8");

  it("keeps legal links and version label contract", () => {
    expect(source).toContain("APP_VERSION_LABEL");
    expect(source).toContain("/legal/privacy");
    expect(source).toContain("aTx⚡Finance");
  });

  it("keeps watermark decorative (not asserted as legal advice)", () => {
    expect(source).toMatch(/app-footer-watermark[^>]*aria-hidden/s);
  });

  it("renders optional subline stack only when subline is passed", () => {
    expect(source).toContain("subline ?");
    expect(source).toContain("app-footer-subline-stack");
  });
});
