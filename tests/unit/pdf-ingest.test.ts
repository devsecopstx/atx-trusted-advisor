import { describe, expect, it } from "vitest";

import {
    buildPdfIngestDocumentFields,
    buildPdfIngestFrontmatter,
    chunkMarkdownFilename,
    normalizeRiskLevel,
    parsePythonIngestStdout,
    PDF_INGEST_SLUG_RE,
    PDF_INGEST_XAI_FIELD_DEFINITIONS,
    pdfIngestManifestSchema,
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

  it("validates ingest manifest schema with xai collection fields", () => {
    const parsed = pdfIngestManifestSchema.parse({
      version: 1,
      slug: "wheel-2026",
      title: "Wheel",
      riskLevel: "balanced",
      outlook: "Bullish Vol",
      tags: ["wheel"],
      sourcePdf: "source.pdf",
      ingestedAt: "2026-05-18T12:00:00.000Z",
      chunkFiles: ["wheel-2026.md"],
      segment: "options-strategy-advanced",
      xaiCollectionId: "collection_abc",
      xaiCollectionName: "xfinance-pdf-ingest-wheel-2026"
    });
    expect(parsed.xaiCollectionName).toContain("xfinance-pdf-ingest-");
  });

  it("defines xAI field_definitions including tags for later edits", () => {
    const keys = PDF_INGEST_XAI_FIELD_DEFINITIONS.map((row) => row.key);
    expect(keys).toContain("tags");
    expect(keys).toContain("risk_level");
    expect(keys).toContain("market_condition");
  });

  it("buildPdfIngestDocumentFields maps manifest tags to comma-separated tags field", () => {
    const fields = buildPdfIngestDocumentFields({
      manifest: {
        version: 1,
        slug: "iron-condor",
        title: "Iron condor desk",
        riskLevel: "balanced",
        outlook: "Range bound",
        tags: ["iron-condor", "adjustment"],
        sourcePdf: "source.pdf",
        ingestedAt: "2026-05-18T12:00:00.000Z",
        chunkFiles: ["iron-condor.md"],
        segment: "options-strategy-advanced"
      },
      chunkFile: "iron-condor.md",
      frontmatter: { strategy_type: "iron_condor" }
    });
    expect(fields.slug).toBe("iron-condor");
    expect(fields.tags).toBe("iron-condor,adjustment");
    expect(fields.chunk_file).toBe("iron-condor.md");
  });

  it("parses python stdout when pymupdf prints progress before JSON", () => {
    const payload = { pageCount: 2, title: "Desk", chunks: [{ index: 1, markdown: "# Hi" }] };
    const noisy = `=== Document parser messages ===\nUsing Tesseract.\n\n${JSON.stringify(payload)}`;
    const parsed = parsePythonIngestStdout(noisy);
    expect(parsed.pageCount).toBe(2);
    expect(parsed.chunks).toHaveLength(1);
  });
});
