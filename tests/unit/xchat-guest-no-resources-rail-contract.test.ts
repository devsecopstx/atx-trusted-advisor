import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the `/xchat` guest experience to render without the public **Resources**
 * sidebar (`AppUserResourcesRailSection`, injected as the default rail by
 * `XchatGuestReadonlyShell`). Guests should see the sign-in/register panel
 * full-width with the global footer; the workspace rail is reserved for
 * signed-in pending-approval users (separate branch with an explicit
 * `pendingWorkspaceRail`).
 */

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("/xchat guest layout — no Resources sidebar for unauthenticated users", () => {
  const source = readSource("src/app/xchat/page.tsx");

  it("does not wrap the unauthenticated branch in XchatGuestReadonlyShell", () => {
    const guestBranchStart = source.indexOf("if (!session) {");
    const guestBranchEnd = source.indexOf("const approved = canUserLogin");
    expect(guestBranchStart).toBeGreaterThan(0);
    expect(guestBranchEnd).toBeGreaterThan(guestBranchStart);
    const guestBlock = source.slice(guestBranchStart, guestBranchEnd);
    expect(guestBlock).not.toMatch(/<XchatGuestReadonlyShell/);
  });

  it("renders XchatGuestPanel inside a scrollable main column with a GlobalFooter for guests", () => {
    const guestBranchStart = source.indexOf("if (!session) {");
    const guestBranchEnd = source.indexOf("const approved = canUserLogin");
    const guestBlock = source.slice(guestBranchStart, guestBranchEnd);
    expect(guestBlock).toMatch(/overflow-y-auto overscroll-contain[\s\S]*?<XchatGuestPanel/);
    expect(guestBlock).toMatch(/<GlobalFooter \/>/);
  });

  it("still uses XchatGuestReadonlyShell for signed-in pending-approval users (separate branch)", () => {
    const pendingBranchStart = source.indexOf("const approved = canUserLogin");
    const pendingBlock = source.slice(pendingBranchStart);
    expect(pendingBlock).toMatch(/<XchatGuestReadonlyShell/);
    expect(pendingBlock).toMatch(/rail={pendingWorkspaceRail \?\? undefined}/);
  });
});
