import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/resources/about page contract", () => {
  const pageSrc = readFileSync(join(process.cwd(), "src/app/resources/about/page.tsx"), "utf8");

  it("renders eight pillar cards after intro copy and exposes #eight-pillars", () => {
    expect(pageSrc).toContain('id="eight-pillars"');
    expect(pageSrc).toContain("AboutPillarCards");
    expect(pageSrc).toContain("ADVISORY_RESOURCE_PILLARS");
    expect(pageSrc).toMatch(/Welcome to aTx Trusted Advisory[\s\S]*eight-pillars/);
  });
});
