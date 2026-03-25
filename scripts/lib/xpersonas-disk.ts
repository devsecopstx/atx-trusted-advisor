/**
 * Walk a directory for persona spec files (.yaml, .yml, .md with YAML frontmatter)
 * and normalize into a shape compatible with `buildYamlDerived` in sync-xpersonas-from-yaml.ts.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { loadPersonaDocFromText } from "@/modules/xchat/persona-spec-text";

export async function collectPersonaSpecFiles(absRoot: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(absDir: string): Promise<void> {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".")) {
        continue;
      }
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
      } else if (ent.isFile()) {
        const low = ent.name.toLowerCase();
        if (low === "readme.md") {
          continue;
        }
        if (low.endsWith(".yaml") || low.endsWith(".yml") || low.endsWith(".md")) {
          out.push(abs);
        }
      }
    }
  }
  await walk(absRoot);
  return out.sort();
}

export async function loadPersonaDocFromFile(
  absPath: string,
  repoRoot: string
): Promise<{ rel: string; doc: Record<string, unknown> } | { error: string }> {
  const rel = absPath.startsWith(repoRoot) ? absPath.slice(repoRoot.length).replace(/^\//, "") : absPath;
  let text: string;
  try {
    text = await readFile(absPath, "utf8");
  } catch (e) {
    return { error: `${rel}: read failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  return loadPersonaDocFromText(rel, text, basename(absPath));
}
