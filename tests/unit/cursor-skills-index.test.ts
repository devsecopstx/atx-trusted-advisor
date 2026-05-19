import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SKILLS_ROOT = path.join(process.cwd(), ".cursor", "skills");
const README_PATH = path.join(SKILLS_ROOT, "README.md");

const ALLOWED_ROOT_FILES = new Set([
  "README.md",
  "skill-authoring.md",
  "OPTIONS_STRATEGY_SKILL_TEMPLATE.md",
]);

const ALLOWED_NON_SKILL_DIRS = new Set<string>();

function listSkillFolders(): string[] {
  return fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(SKILLS_ROOT, name, "SKILL.md")))
    .sort();
}

function parseReadmeSkillLinks(markdown: string): string[] {
  const links = [...markdown.matchAll(/\]\(([^)]+\/SKILL\.md)\)/g)].map((m) => {
    const rel = m[1]!.replace(/^\.\//, "");
    return rel.split("/")[0]!;
  });
  return [...new Set(links)].sort();
}

function parseFrontmatter(skillMd: string): Record<string, string> {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) out[key] = value;
  }
  return out;
}

describe("cursor skills index", () => {
  it("README links match on-disk skill folders", () => {
    const readme = fs.readFileSync(README_PATH, "utf8");
    const linked = parseReadmeSkillLinks(readme);
    const folders = listSkillFolders();

    const missingOnDisk = linked.filter(
      (folder) => !fs.existsSync(path.join(SKILLS_ROOT, folder, "SKILL.md")),
    );
    const missingInReadme = folders.filter((folder) => !linked.includes(folder));

    expect(missingOnDisk, `README links without SKILL.md: ${missingOnDisk.join(", ")}`).toEqual(
      [],
    );
    expect(
      missingInReadme,
      `Skill folders not in README: ${missingInReadme.join(", ")}`,
    ).toEqual([]);
  });

  it("every SKILL.md has required frontmatter", () => {
    for (const folder of listSkillFolders()) {
      const raw = fs.readFileSync(path.join(SKILLS_ROOT, folder, "SKILL.md"), "utf8");
      const fm = parseFrontmatter(raw);
      expect(fm.name, `${folder}: name`).toBeTruthy();
      expect(fm.description, `${folder}: description`).toBeTruthy();
    }
  });

  it("has no orphan non-skill directories under .cursor/skills", () => {
    const dirs = fs
      .readdirSync(SKILLS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const orphans = dirs.filter(
      (name) =>
        !ALLOWED_NON_SKILL_DIRS.has(name) &&
        !fs.existsSync(path.join(SKILLS_ROOT, name, "SKILL.md")),
    );
    expect(orphans, `Move to atx-docs/ or add SKILL.md: ${orphans.join(", ")}`).toEqual([]);
  });

  it("skills root only contains allowed loose files", () => {
    const loose = fs
      .readdirSync(SKILLS_ROOT, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => !ALLOWED_ROOT_FILES.has(name));
    expect(loose).toEqual([]);
  });
});
