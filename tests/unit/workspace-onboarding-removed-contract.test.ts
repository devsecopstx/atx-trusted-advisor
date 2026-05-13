import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the removal of the `/workspace/onboarding` "Quick setup — Your default
 * portfolio is ready" interstitial. Post-auth flows now land directly on
 * `/xchat`; if anything reintroduces the route or the `?billing_welcome=1`
 * toast handoff, this test fails so the regression is caught at PR review.
 */

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("/workspace/onboarding removal", () => {
  it("the route + supporting client components are gone from the tree", () => {
    expect(existsSync(resolve(ROOT, "src/app/workspace/onboarding/page.tsx"))).toBe(false);
    expect(existsSync(resolve(ROOT, "src/app/workspace/onboarding/billing-welcome-toast.tsx"))).toBe(false);
    expect(existsSync(resolve(ROOT, "src/app/workspace/onboarding/workspace-onboarding-continue.tsx"))).toBe(false);
  });

  it("the onboarding-prompt helper and its test are removed (only used by the deleted page)", () => {
    expect(existsSync(resolve(ROOT, "src/lib/workspace-onboarding-prompt.ts"))).toBe(false);
    expect(existsSync(resolve(ROOT, "tests/unit/workspace-onboarding-prompt.test.ts"))).toBe(false);
  });

  it("/account/billing post-auth landing always points at /xchat (no quick-setup detour)", () => {
    const source = readSource("src/app/account/billing/page.tsx");
    expect(source).toMatch(/const postAuthLandingPath = "\/xchat"/);
    expect(source).not.toMatch(/\/workspace\/onboarding/);
  });

  it("BillingGuestExperience post-signup login `next` lands on /xchat", () => {
    const source = readSource("src/app/account/billing/billing-guest-experience.tsx");
    expect(source).toMatch(/next: "\/xchat"/);
    expect(source).not.toMatch(/\/workspace\/onboarding/);
  });
});
