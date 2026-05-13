import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the dark-theme icon used in the approved header (and the standalone
 * trigger) to the clean Lucide-style crescent path. The previous shape used a
 * concave "bite" path that visually read as a curved `S` at 16px, not a moon.
 *
 * If this fails, either restore the crescent path or update both surfaces +
 * this test together.
 */

const ROOT = resolve(__dirname, "../..");
const CRESCENT_PATH = "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z";
const LEGACY_BITE_PATH_FRAGMENT = "3.14 6.32";

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("dark-theme moon icon — clean crescent (approved header + trigger)", () => {
  it("WorkspaceRailAppearance uses the Lucide crescent path", () => {
    const source = readSource("src/app/ui/workspace-rail-appearance.tsx");
    expect(source).toContain(CRESCENT_PATH);
    expect(source).not.toContain(LEGACY_BITE_PATH_FRAGMENT);
  });

  it("PublicThemePicker uses the same crescent path for visual parity", () => {
    const source = readSource("src/app/ui/public-theme-picker.tsx");
    expect(source).toContain(CRESCENT_PATH);
    expect(source).not.toContain(LEGACY_BITE_PATH_FRAGMENT);
  });
});
