/**
 * CLI: npm run ingest:pdf -- --file=/path/report.pdf --slug=my-slug --title="..." --risk=Balanced --outlook="Bullish Vol" --tags=a,b
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
    ingestPdfToRagCollection,
    PDF_INGEST_SLUG_RE,
    type PdfIngestCliInput,
    type PdfIngestKbSegment
} from "../src/modules/rag/pdf-ingest";

function parseArgs(argv: string[]): PdfIngestCliInput {
  const map = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq === -1) {
      map.set(arg.slice(2), "true");
    } else {
      map.set(arg.slice(2, eq), arg.slice(eq + 1));
    }
  }

  const file = map.get("file")?.trim();
  const slug = map.get("slug")?.trim().toLowerCase();
  const title = map.get("title")?.trim();
  const risk = map.get("risk")?.trim() ?? "Balanced";
  const outlook = map.get("outlook")?.trim() ?? "Neutral";
  const tagsRaw = map.get("tags")?.trim() ?? "";
  const segmentRaw = map.get("segment")?.trim() as PdfIngestKbSegment | undefined;

  if (!file) {
    throw new Error("missing --file=/path/to/report.pdf");
  }
  if (!slug || !PDF_INGEST_SLUG_RE.test(slug)) {
    throw new Error("missing or invalid --slug=kebab-case-slug");
  }
  if (!title) {
    throw new Error("missing --title=\"Document title\"");
  }

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    file,
    slug,
    title,
    risk,
    outlook,
    tags,
    ...(segmentRaw ? { segment: segmentRaw } : {})
  };
}

async function main(): Promise<void> {
  const input = parseArgs(process.argv.slice(2));
  const repoRoot = join(import.meta.dirname, "..");
  const { manifest, outDir } = await ingestPdfToRagCollection(repoRoot, input);
  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: manifest.slug,
        outDir,
        chunkFiles: manifest.chunkFiles,
        segment: manifest.segment,
        next: [
          "npm run seed:options-strategy  # Mongo catalog",
          "npm run seed:finance-xai-collection  # xAI Finance KB (all segments + pdf-ingest folders)"
        ]
      },
      null,
      2
    )
  );
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ingest:pdf] ${message}`);
  try {
    await mkdir(join(process.cwd(), ".tmp"), { recursive: true });
    await writeFile(join(process.cwd(), ".tmp", "ingest-pdf-error.log"), `${message}\n`, "utf8");
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
