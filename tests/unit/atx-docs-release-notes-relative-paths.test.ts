import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: `atx-docs/sre-ops/release-notes.md` lives one level under `atx-docs/`.
 * Links to PLAN, design-system, sibling sre-ops files, and repo `.cursor/skills/` must use
 * the correct relative depth (`../…`, `../../.cursor/…`) or `./…` for same-dir targets.
 * CI runs `node scripts/check-markdown-links.mjs` via eslint; this pins the common mistake.
 */
describe("atx-docs/sre-ops/release-notes.md relative paths", () => {
  const releaseNotes = readFileSync(join(process.cwd(), "atx-docs/sre-ops/release-notes.md"), "utf8");

  it("does not use ./PLAN.md or ./design-system/ from sre-ops (wrong depth)", () => {
    expect(releaseNotes).not.toMatch(/\]\(\.\/PLAN\.md\)/);
    expect(releaseNotes).not.toMatch(/\]\(\.\/design-system\//);
  });

  it("does not use ./sre-ops/ when already inside atx-docs/sre-ops", () => {
    expect(releaseNotes).not.toMatch(/\]\(\.\/sre-ops\//);
  });

  it("does not use ../.cursor/ from sre-ops (must be ../../.cursor/)", () => {
    expect(releaseNotes).not.toMatch(/\]\(\.\.\/\.cursor\/skills\//);
  });
});
