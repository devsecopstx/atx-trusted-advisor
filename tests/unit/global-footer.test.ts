import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("GlobalFooter", () => {
  const footerPath = path.join(process.cwd(), "src/app/ui/global-footer.tsx");
  const source = readFileSync(footerPath, "utf8");

  it("keeps legal links and version label contract", () => {
    expect(source).toContain("APP_VERSION_LABEL");
    expect(source).toContain("/legal/privacy");
    expect(source).toContain("/legal/terms");
    expect(source).toContain("atx Trusted Advisor");
    expect(source).toContain("USER_PRODUCT_WHITELABEL_SUBLINE");
  });

  it("does not ship casual or jokey compliance copy in chrome", () => {
    expect(source).not.toMatch(/sue me bro|don.?t sue|sue me, bro/i);
  });

  it("keeps subline stack and optional subline override contract", () => {
    expect(source).toContain("app-footer-subline-stack");
    expect(source).toContain("subline ??");
    expect(source).not.toContain("app-footer-watermark");
  });
});
