import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

function assertPersonaYamlShape(filePath: string, stem: string): void {
  const raw = readFileSync(filePath, "utf8");
  const first = raw.split("\n")[0] ?? "";
  expect(first).toBe(`# atx-rag-collection/personas-trusted-family/${stem}.yaml`);
  for (const key of PERSONA_YAML_REQUIRED_KEYS) {
    expect(raw.includes(`\n${key}`) || raw.startsWith(`${key}\n`) || raw.startsWith(key)).toBe(true);
  }
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
    expect(existsSync(join(strategyDir, "options-coreskills.md"))).toBe(true);
  });

  it("persona seed YAML files match project-standard key set", () => {
    const yamlFiles = readdirSync(personasDir).filter((f) => f.endsWith(".yaml"));
    expect(yamlFiles.length).toBeGreaterThan(0);
    for (const file of yamlFiles) {
      const stem = file.replace(/\.yaml$/u, "");
      assertPersonaYamlShape(join(personasDir, file), stem);
    }
  });
});
