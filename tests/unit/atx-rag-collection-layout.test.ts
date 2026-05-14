import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const PERSONA_YAML_REQUIRED_KEYS = [
  "id:",
  "name:",
  "description:",
  "icon:",
  "color:",
  "INSTRUCTIONS:",
  "setup:",
  "model:",
  "system_prompt:",
  "always_include:",
  "never_include:",
  "commands:",
] as const;

function walkYamlFiles(absDir: string): string[] {
  const out: string[] = [];
  if (!existsSync(absDir)) {
    return out;
  }
  for (const ent of readdirSync(absDir, { withFileTypes: true })) {
    const p = join(absDir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkYamlFiles(p));
    } else if (ent.isFile() && ent.name.endsWith(".yaml")) {
      out.push(p);
    }
  }
  return out.sort();
}

function assertPersonaYamlShape(filePath: string, xpersonasRoot: string): void {
  const rel = relative(xpersonasRoot, filePath).replace(/\\/g, "/");
  const raw = readFileSync(filePath, "utf8");
  const first = raw.split("\n")[0] ?? "";
  expect(first).toBe(`# atx-rag-collection/xpersonas/${rel}`);
  for (const key of PERSONA_YAML_REQUIRED_KEYS) {
    expect(raw.includes(`\n${key}`) || raw.startsWith(`${key}\n`) || raw.startsWith(key)).toBe(true);
  }
}

/** RAG convention: folder name === file stem (lowercase readme skipped at ingest). */
function assertKebabFolderContainsSameStemFile(absDir: string, ext: string): void {
  const stem = basename(absDir);
  const expected = join(absDir, `${stem}${ext}`);
  expect(existsSync(expected), `expected ${expected}`).toBe(true);
  const otherFiles = readdirSync(absDir).filter((n) => n.toLowerCase() !== "readme.md");
  const matching = otherFiles.filter((n) => n === `${stem}${ext}`);
  expect(
    matching.length,
    `${absDir}: folder "${stem}" should contain exactly one primary ${ext} named ${stem}${ext} (found: ${otherFiles.join(", ")})`
  ).toBe(1);
}

describe("atx-rag-collection layout", () => {
  const base = join(process.cwd(), "atx-docs", "rag-collection");
  const xpersonasDir = join(base, "xpersonas");

  it("documents RAG source tree paths referenced in README", () => {
    expect(existsSync(join(base, "README.md"))).toBe(true);
    expect(existsSync(xpersonasDir)).toBe(true);
    expect(existsSync(join(base, "finance-reference-docs"))).toBe(true);
    expect(existsSync(join(base, "example-prompts"))).toBe(true);
    const strategyDir = join(base, "options-strategy");
    expect(existsSync(strategyDir)).toBe(true);
    expect(existsSync(join(base, "options-strategy-core", "options-coreskills.md"))).toBe(true);
    expect(existsSync(join(base, "options-strategy-advanced", "iron-condor.md"))).toBe(true);
    expect(existsSync(join(base, "example-prompts", "example-prompts", "example-prompts.md"))).toBe(true);
  });

  it("xpersonas YAML seed specs match project-standard key set and path comment", () => {
    const yamlFiles = walkYamlFiles(xpersonasDir);
    expect(yamlFiles.length).toBeGreaterThan(0);
    for (const file of yamlFiles) {
      assertPersonaYamlShape(file, xpersonasDir);
    }
  });

  it("xpersonas: exactly one .yaml per subfolder, no persona .md (YAML-only Grok specs)", () => {
    for (const ent of readdirSync(xpersonasDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) {
        continue;
      }
      const sub = join(xpersonasDir, ent.name);
      const yamls = readdirSync(sub).filter((f) => f.endsWith(".yaml"));
      const mds = readdirSync(sub).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
      expect(mds.length, `${sub}: xpersonas segment must not use .md persona files`).toBe(0);
      expect(yamls.length, `${sub}: expected exactly one persona yaml`).toBe(1);
    }
  });

  it("xpersonas folders that match filename stem use stem/stem.yaml", () => {
    for (const name of ["exam-coach", "advisor", "finance-advisor"]) {
      assertKebabFolderContainsSameStemFile(join(xpersonasDir, name), ".yaml");
    }
  });

  it("options-strategy narrative folders follow stem/stem.md (RAG path tags)", () => {
    const strategyDir = join(base, "options-strategy");
    for (const ent of readdirSync(strategyDir, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name === "options-coreskills") {
        continue;
      }
      const sub = join(strategyDir, ent.name);
      assertKebabFolderContainsSameStemFile(sub, ".md");
    }
  });

  it("options-strategy-core hub index is options-coreskills.md (flat Finance KB segment)", () => {
    const p = join(base, "options-strategy-core", "options-coreskills.md");
    expect(existsSync(p), `expected ${p}`).toBe(true);
  });

  it("options-strategy nested options-coreskills hub uses stem/stem.md (Mongo catalog)", () => {
    assertKebabFolderContainsSameStemFile(join(base, "options-strategy", "options-coreskills"), ".md");
  });

  it("finance-reference-docs PDFs use stem/stem.pdf folders", () => {
    const fin = join(base, "finance-reference-docs");
    for (const ent of readdirSync(fin, { withFileTypes: true })) {
      if (!ent.isDirectory()) {
        continue;
      }
      const sub = join(fin, ent.name);
      assertKebabFolderContainsSameStemFile(sub, ".pdf");
    }
  });

  it("example-prompts uses stem/stem.md", () => {
    assertKebabFolderContainsSameStemFile(join(base, "example-prompts", "example-prompts"), ".md");
  });

  it("options-strategy-core and options-strategy-advanced use flat ingestible markdown at segment root", () => {
    for (const seg of ["options-strategy-core", "options-strategy-advanced"]) {
      const segDir = join(base, seg);
      expect(existsSync(segDir)).toBe(true);
      const mds = readdirSync(segDir).filter((f) => f.endsWith(".md"));
      expect(mds.length, `${seg}: expected at least one .md`).toBeGreaterThan(0);
    }
  });

  it("segment roots do not leave loose ingestible files next to segment folders", () => {
    const exts = new Set([".md", ".pdf", ".yaml", ".yml"]);
    const flatMarkdownSegments = new Set(["options-strategy-core", "options-strategy-advanced"]);
    for (const seg of [
      "xpersonas",
      "finance-reference-docs",
      "example-prompts",
      "options-strategy",
      "options-strategy-core",
      "options-strategy-advanced"
    ]) {
      const segDir = join(base, seg);
      for (const name of readdirSync(segDir)) {
        const p = join(segDir, name);
        if (!statSync(p).isFile()) {
          continue;
        }
        const low = name.toLowerCase();
        if (low === "readme.md" || low === ".ds_store") {
          continue;
        }
        const dot = name.lastIndexOf(".");
        const ext = dot >= 0 ? name.slice(dot) : "";
        if (flatMarkdownSegments.has(seg) && ext === ".md") {
          continue;
        }
        expect(exts.has(ext), `unexpected loose file at segment root (move under stem/stem${ext}): ${p}`).toBe(
          false
        );
      }
    }
  });
});
