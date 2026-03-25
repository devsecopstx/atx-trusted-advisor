import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const AGENT_FILES = [
  ".cursor/agents/frontend.yaml",
  ".cursor/agents/backend.yaml",
  ".cursor/agents/reviewer.yaml",
  ".cursor/agents/marketing.yaml",
  ".cursor/agents/feature-branding.yaml",
  ".cursor/agents/sre-ops-admin.yaml"
] as const;

describe("cursor agent persona config sanity", () => {
  it("keeps INSTRUCTIONS as YAML list items (not implicit numeric keys)", () => {
    for (const relativePath of AGENT_FILES) {
      const content = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(content).toMatch(/(?:^|\n)INSTRUCTIONS:\n(?: {2}- .+\n?)+/);
      expect(content).not.toMatch(/(?:^|\n)INSTRUCTIONS:\n(?:\d+\.\s.+\n?)+/);
      expect(content).not.toMatch(/\n {2}- \d+\s+[A-Z_]+:/);
    }
  });

  it("does not overwrite persona yaml files during worktree setup", () => {
    const worktreesPath = resolve(process.cwd(), ".cursor/worktrees.json");
    const raw = readFileSync(worktreesPath, "utf8");
    const parsed = JSON.parse(raw) as { worktrees?: Array<{ setup?: string }> };
    const setups = parsed.worktrees?.map((item) => item.setup ?? "") ?? [];

    for (const setup of setups) {
      expect(setup).not.toMatch(/>\s*\.cursor\/agents\/[^"' ]+\.yaml/);
    }
  });
});
