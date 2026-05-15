import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
    coerceFinanceKbValueForXaiField,
    extractFinanceKbFrontmatterMetadata,
    financeKbLogicalUploadName,
    financeKbMetadataToXaiFields,
    indexFinanceKbRemoteDocumentsByLogicalName,
    inferRiskProfile,
    resolveFinanceKbRoots,
    resolveQuantDeskKbFiles,
    strategySlugFromRelativePath
} from "@/modules/xchat/finance-kb-sync";

describe("finance-kb-sync helpers", () => {
  it("extractFinanceKbFrontmatterMetadata returns whitelisted keys from YAML block", () => {
    const raw = `---
id: xfinance-strategy-wheel
name: xfinance-strategy-wheel
description: Wheel narrative
strategy_type: wheel
risk_level: balanced
market_condition: neutral_to_bullish
complexity: core
underlying_type: stock
tags: [income, assignment]
extra_ignored: true
---

# Body
`;
    expect(extractFinanceKbFrontmatterMetadata(raw)).toEqual({
      id: "xfinance-strategy-wheel",
      name: "xfinance-strategy-wheel",
      description: "Wheel narrative",
      strategy_type: "wheel",
      risk_level: "balanced",
      market_condition: "neutral_to_bullish",
      complexity: "core",
      underlying_type: "stock",
      tags: ["income", "assignment"]
    });
  });

  it("extractFinanceKbFrontmatterMetadata returns {} when no frontmatter", () => {
    expect(extractFinanceKbFrontmatterMetadata("# Title only\n")).toEqual({});
  });

  it("extractFinanceKbFrontmatterMetadata reads YAML after a markdown title line (finance-core layout)", () => {
    const raw = `# atx-rag-collection/finance-core/foo.md

---
id: xfinance-finance-core-foo
name: finance-core-foo
description: Desk note
complexity: core
underlying_type: stock
strategy_type: macro
risk_level: balanced
tags: [finance_core, macro]
---

# Body
`;
    expect(extractFinanceKbFrontmatterMetadata(raw, { kbSegment: "finance-core" })).toEqual({
      id: "xfinance-finance-core-foo",
      name: "finance-core-foo",
      description: "Desk note",
      complexity: "core",
      underlying_type: "stock",
      strategy_type: "macro",
      risk_level: "balanced",
      tags: ["finance_core", "macro"]
    });
  });

  it("extractFinanceKbFrontmatterMetadata allows doc_type on finance-core segment", () => {
    const raw = `# Title

---
id: x
name: x
description: d
doc_type: desk_reference
tags: [a]
---

# Body
`;
    expect(extractFinanceKbFrontmatterMetadata(raw, { kbSegment: "finance-core" })).toMatchObject({
      doc_type: "desk_reference",
      tags: ["a"]
    });
  });

  it("extractFinanceKbFrontmatterMetadata uses guideline key set for atx-response-guidelines segment", () => {
    const raw = `---
id: xfinance-guidelines-citation-format
name: xfinance-guidelines-citation-format
description: Cite sources
doc_type: citation_format
surface: xchat
tags: [citations]
strategy_type: wheel
---

# Body
`;
    expect(extractFinanceKbFrontmatterMetadata(raw, { kbSegment: "atx-response-guidelines" })).toEqual({
      id: "xfinance-guidelines-citation-format",
      name: "xfinance-guidelines-citation-format",
      description: "Cite sources",
      doc_type: "citation_format",
      surface: "xchat",
      tags: ["citations"]
    });
  });

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
    expect(sources).toContain("finance-core");
    for (const r of roots) {
      expect(r.dir).toBe(join(repoRoot, "atx-docs", "rag-collection", r.source));
    }
  });

  it("financeKbLogicalUploadName matches segment and path sanitization", () => {
    expect(financeKbLogicalUploadName("finance-core", "macro-outlooks/foo.md")).toBe(
      "finance-core__macro-outlooks_foo.md"
    );
  });

  it("coerceFinanceKbValueForXaiField maps scalars, arrays, and objects", () => {
    expect(coerceFinanceKbValueForXaiField("x")).toBe("x");
    expect(coerceFinanceKbValueForXaiField(2024)).toBe(2024);
    expect(coerceFinanceKbValueForXaiField(true)).toBe("true");
    expect(coerceFinanceKbValueForXaiField(["a", 1])).toBe("a,1");
    expect(coerceFinanceKbValueForXaiField({ a: 1 })).toBe("{\"a\":1}");
    expect(coerceFinanceKbValueForXaiField(null)).toBeUndefined();
  });

  it("financeKbMetadataToXaiFields filters to allowed keys and coerces", () => {
    const allowed = new Set(["id", "tags", "year"]);
    expect(
      financeKbMetadataToXaiFields(
        { id: "doc-1", tags: ["income", "hedge"], year: 2024, extra: "drop" },
        allowed
      )
    ).toEqual({ id: "doc-1", tags: "income,hedge", year: 2024 });
  });

  it("financeKbMetadataToXaiFields matches camelCase field_definitions to snake_case metadata", () => {
    const allowed = new Set(["riskProfile", "docType", "lastUpdated"]);
    expect(
      financeKbMetadataToXaiFields(
        { risk_profile: "balanced", doc_type: "guide", last_updated: "2026-01-01T00:00:00.000Z" },
        allowed
      )
    ).toEqual({
      riskProfile: "balanced",
      docType: "guide",
      lastUpdated: "2026-01-01T00:00:00.000Z"
    });
  });

  it("resolveQuantDeskKbFiles lists nested quant playbooks for Finance KB sync", () => {
    const repoRoot = join(process.cwd());
    const files = resolveQuantDeskKbFiles(repoRoot);
    expect(files.length).toBeGreaterThanOrEqual(5);
    expect(files.some((f) => f.rel === "quant-monte-carlo-wheel/quant-monte-carlo-wheel.md")).toBe(true);
    expect(files.every((f) => f.source === "options-strategy-core")).toBe(true);
  });

  it("indexFinanceKbRemoteDocumentsByLogicalName is last-wins on duplicate names", () => {
    const idx = indexFinanceKbRemoteDocumentsByLogicalName([
      { fileId: "file_a", name: "finance-core__x.md" },
      { fileId: "file_b", name: "finance-core__x.md" }
    ]);
    expect(idx.get("finance-core__x.md")).toBe("file_b");
  });
});
