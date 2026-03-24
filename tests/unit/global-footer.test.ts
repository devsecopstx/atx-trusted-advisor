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
    expect(source).toContain("aTx⚡Finance");
  });

  it("does not ship casual or jokey compliance copy in chrome", () => {
    expect(source).not.toMatch(/don't sue|sue me, bro/i);
  });

  it("renders subline stack only when subline is passed (no empty bordered block)", () => {
    expect(source).toContain("app-footer-subline-stack");
    expect(source).toContain("subline ?");
    expect(source).not.toContain("app-footer-watermark");
  });
});
