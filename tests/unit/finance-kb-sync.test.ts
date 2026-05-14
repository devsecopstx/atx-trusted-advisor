import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
    inferRiskProfile,
    resolveFinanceKbRoots,
    strategySlugFromRelativePath
} from "@/modules/xchat/finance-kb-sync";

describe("finance-kb-sync helpers", () => {
  it("strategySlugFromRelativePath uses nested folder slug", () => {
    expect(strategySlugFromRelativePath("iron-condor/iron-condor.md")).toBe("iron-condor");
    expect(strategySlugFromRelativePath("foo/bar/baz.md")).toBe("foo");
  });

  it("strategySlugFromRelativePath uses flat file stem", () => {
    expect(strategySlugFromRelativePath("wheel-strategy.md")).toBe("wheel-strategy");
    expect(strategySlugFromRelativePath("citation-format.md")).toBe("citation-format");
  });

  it("inferRiskProfile maps merged core slugs, strategy slugs, and leaves meta docs unset", () => {
    expect(inferRiskProfile("covered-call-and-csp.md")).toBe("conservative");
    expect(inferRiskProfile("iron-condor-jade-lizard.md")).toBe("balanced");
    expect(inferRiskProfile("bull-call-debit-spread.md")).toBe("balanced");
    expect(inferRiskProfile("calendar-spread/calendar-spread.md")).toBe("balanced");
    expect(inferRiskProfile("ratio-spread/ratio-spread.md")).toBe("aggressive");
    expect(inferRiskProfile("citation-format.md")).toBeUndefined();
  });

  it("resolveFinanceKbRoots lists existing segment dirs with stable paths", () => {
    const repoRoot = process.cwd();
    const roots = resolveFinanceKbRoots(repoRoot);
    const sources = roots.map((r) => r.source);
    expect(sources).toContain("options-strategy-core");
    expect(sources).toContain("options-strategy-advanced");
    expect(sources).toContain("atx-response-guidelines");
    expect(sources).toContain("finance-reference-docs");
    for (const r of roots) {
      expect(r.dir).toBe(join(repoRoot, "atx-docs", "rag-collection", r.source));
    }
  });
});
