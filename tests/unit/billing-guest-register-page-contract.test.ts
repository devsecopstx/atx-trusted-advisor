import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("account billing guest registration layout contract", () => {
  const source = readSource("src/app/account/billing/page.tsx");

  it("does not wrap the guest registration billing page in the xChat rail shell", () => {
    expect(source).not.toMatch(/XchatGuestReadonlyShell/);
    expect(source).toMatch(/<main className="app-user-shell-with-rail--padded min-h-full w-full">/);
  });

  it("only resolves the workspace rail for approved signed-in users", () => {
    expect(source).toMatch(/const workspaceProductRail = approved && session/);
    expect(source).toMatch(/<AppUserCollapsibleRailLayout[\s\S]*?rail={workspaceProductRail}/);
  });

  it("lets the guest viewport scroll instead of locking the body overflow", () => {
    expect(source).toMatch(/overflow-y-auto overscroll-contain/);
    expect(source).toMatch(/approved[\s\S]*?overflow-hidden[\s\S]*?:[\s\S]*?overflow-y-auto overscroll-contain/);
  });
});
