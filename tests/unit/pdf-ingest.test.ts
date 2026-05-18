import { describe, expect, it } from "vitest";

import {
    buildPdfIngestFrontmatter,
    chunkMarkdownFilename,
    normalizeRiskLevel,
    parsePythonIngestStdout,
    PDF_INGEST_SLUG_RE,
    pdfIngestXaiCollectionName,
    slugifyOutlook
} from "@/modules/rag/pdf-ingest";

describe("pdf-ingest helpers", () => {
  it("validates slug pattern", () => {
    expect(PDF_INGEST_SLUG_RE.test("advanced-iron-condor-2026")).toBe(true);
    expect(PDF_INGEST_SLUG_RE.test("Bad_Slug")).toBe(false);
  });

  it("normalizes risk levels", () => {
    expect(normalizeRiskLevel("Balanced")).toBe("balanced");
    expect(normalizeRiskLevel("Conservative")).toBe("conservative");
    expect(normalizeRiskLevel("Aggressive")).toBe("aggressive");
  });

  it("slugifies outlook for market_condition", () => {
    expect(slugifyOutlook("Bullish Vol")).toBe("bullish_vol");
  });

  it("builds frontmatter with tags and ingest comment", () => {
    const fm = buildPdfIngestFrontmatter({
      slug: "wheel-2026",
      title: "Wheel playbook",
      riskLevel: "balanced",
      outlook: "Bullish Vol",
      tags: ["wheel", "income"],
      chunkIndex: 1,
      chunkTotal: 1,
      pageCount: 12
    });
    expect(fm).toContain("risk_level: balanced");
    expect(fm).toContain("market_condition: bullish_vol");
    expect(fm).toContain("tags: [pdf_ingest, wheel, income]");
    expect(fm).toContain("<!-- INGEST:");
    expect(fm).toContain("12 page(s)");
  });

  it("names chunk files for multi-part ingest", () => {
    expect(chunkMarkdownFilename("my-slug", 1, 1)).toBe("my-slug.md");
    expect(chunkMarkdownFilename("my-slug", 2, 3)).toBe("my-slug-part-002.md");
  });

  it("derives per-slug xAI collection name", () => {
    expect(pdfIngestXaiCollectionName("advanced-iron-condor-2026")).toBe(
      "xfinance-pdf-ingest-advanced-iron-condor-2026"
    );
  });

  it("parses python stdout when pymupdf prints progress before JSON", () => {
    const payload = { pageCount: 2, title: "Desk", chunks: [{ index: 1, markdown: "# Hi" }] };
    const noisy = `=== Document parser messages ===\nUsing Tesseract.\n\n${JSON.stringify(payload)}`;
    const parsed = parsePythonIngestStdout(noisy);
    expect(parsed.pageCount).toBe(2);
    expect(parsed.chunks).toHaveLength(1);
  });
});
