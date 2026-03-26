import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const AGENT_FILES = [
  ".cursor/agents/frontend.md",
  ".cursor/agents/backend.md",
  ".cursor/agents/reviewer.md",
  ".cursor/agents/marketing.md",
  ".cursor/agents/branding.md",
  ".cursor/agents/sre.md"
] as const;

function parseSubagentFrontmatter(raw: string): { frontmatter: string; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---\n")) {
    throw new Error("expected leading --- frontmatter");
  }
  const close = trimmed.indexOf("\n---\n", 4);
  if (close < 0) {
    throw new Error("expected closing ---\\n after frontmatter");
  }
  const frontmatter = trimmed.slice(4, close).trim();
  const body = trimmed.slice(close + 5);
  return { frontmatter, body };
}

describe("cursor agent persona config sanity", () => {
  it("uses Markdown subagents with documented frontmatter (name, description, model)", () => {
    for (const relativePath of AGENT_FILES) {
      const content = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      const { frontmatter, body } = parseSubagentFrontmatter(content);
      expect(frontmatter).toMatch(/^name:\s+\S/m);
      expect(frontmatter).toMatch(/^description:/m);
      expect(frontmatter).toMatch(/^model:\s+\S/m);
      expect(body.trim().length).toBeGreaterThan(20);
      expect(frontmatter).not.toMatch(/^icon:/m);
      expect(frontmatter).not.toMatch(/^color:/m);
    }
  });

  it("does not overwrite persona agent files during worktree setup", () => {
    const worktreesPath = resolve(process.cwd(), ".cursor/worktrees.json");
    const raw = readFileSync(worktreesPath, "utf8");
    const parsed = JSON.parse(raw) as { worktrees?: Array<{ setup?: string }> };
    const setups = parsed.worktrees?.map((item) => item.setup ?? "") ?? [];

    for (const setup of setups) {
      expect(setup).not.toMatch(/>\s*\.cursor\/agents\/[^"' ]+\.yaml/);
    }
  });
});
