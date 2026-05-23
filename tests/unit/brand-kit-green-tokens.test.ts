import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("brand kit green token table", () => {
  const cssPath = path.join(process.cwd(), "atx-docs/design-system/atxfinance-brand-kit.css");
  const css = readFileSync(cssPath, "utf8");
  const devMd = readFileSync(path.join(process.cwd(), "DEVELOPMENT.md"), "utf8");

  it("defines xf-green-500 and xf-green-400 in :root", () => {
    expect(css).toContain("--xf-green-500: #22c55e");
    expect(css).toContain("--xf-green-400: #4ade80");
  });

  it("documents authoritative usage table after :root", () => {
    expect(css).toContain("Green token usage (authoritative");
    expect(css).toContain("Weekly recap, scanner results");
    expect(css).toContain("xOptions heat map, portfolio rail");
    expect(css).toContain("New defined-risk wheel card");
    expect(css).toContain("xOptions Step 4 CTA");
  });

  it("mirrors table in DEVELOPMENT.md Branding Tokens", () => {
    expect(devMd).toContain("## Branding Tokens");
    expect(devMd).toContain("--xf-green-500");
    expect(devMd).toContain("xOptions Step 4 CTA");
  });
});
