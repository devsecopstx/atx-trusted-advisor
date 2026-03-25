import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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

function assertPersonaYamlShape(filePath: string): void {
  const stem = basename(dirname(filePath));
  const raw = readFileSync(filePath, "utf8");
  const first = raw.split("\n")[0] ?? "";
  expect(first).toBe(`# atx-rag-collection/personas-trusted-family/${stem}/${stem}.yaml`);
  for (const key of PERSONA_YAML_REQUIRED_KEYS) {
    expect(raw.includes(`\n${key}`) || raw.startsWith(`${key}\n`) || raw.startsWith(key)).toBe(true);
  }
}

function listPersonaSeedYamlFiles(personasDir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(personasDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) {
      continue;
    }
    const stem = ent.name;
    const yamlPath = join(personasDir, stem, `${stem}.yaml`);
    if (existsSync(yamlPath)) {
      out.push(yamlPath);
    }
  }
  return out.sort();
}

/** RAG convention: one ingestible file per folder, folder name === file stem (lowercase readme skipped at ingest). */
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
  const base = join(process.cwd(), "atx-rag-collection");
  const personasDir = join(base, "personas-trusted-family");

  it("documents RAG source tree paths referenced in README", () => {
    expect(existsSync(join(base, "README.md"))).toBe(true);
    expect(existsSync(personasDir)).toBe(true);
    expect(existsSync(join(base, "finance-reference-docs"))).toBe(true);
    expect(existsSync(join(base, "xchat-example-prompts"))).toBe(true);
    const strategyDir = join(base, "options-strategy");
    expect(existsSync(strategyDir)).toBe(true);
    expect(existsSync(join(strategyDir, "options-coreskills", "options-coreskills.md"))).toBe(true);
    expect(existsSync(join(base, "xchat-example-prompts", "atx-example-prompts", "atx-example-prompts.md"))).toBe(
      true
    );
  });

  it("persona seed YAML files match project-standard key set", () => {
    const yamlFiles = listPersonaSeedYamlFiles(personasDir);
    expect(yamlFiles.length).toBeGreaterThan(0);
    for (const file of yamlFiles) {
      assertPersonaYamlShape(file);
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

  it("options-coreskills hub uses stem/stem.md", () => {
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

  it("xchat-example-prompts uses stem/stem.md", () => {
    assertKebabFolderContainsSameStemFile(join(base, "xchat-example-prompts", "atx-example-prompts"), ".md");
  });

  it("segment roots do not leave loose ingestible files next to segment folders", () => {
    const exts = new Set([".md", ".pdf", ".yaml", ".yml"]);
    for (const seg of [
      "personas-trusted-family",
      "finance-reference-docs",
      "xchat-example-prompts",
      "options-strategy",
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
        expect(exts.has(ext), `unexpected loose file at segment root (move under stem/stem${ext}): ${p}`).toBe(
          false
        );
      }
    }
  });
});
