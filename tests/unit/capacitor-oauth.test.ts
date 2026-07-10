import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildCapacitorOAuthCompleteDeepLink,
  isCapNativeOAuthRequest,
  isOAuthLoginPathname,
  parseCapacitorOAuthCompleteDeepLink,
  withCapNativeOAuthQuery
} from "@/lib/capacitor-oauth";

describe("capacitor-oauth paths", () => {
  it("detects OAuth login paths", () => {
    expect(isOAuthLoginPathname("/api/auth/x/login")).toBe(true);
    expect(isOAuthLoginPathname("/api/auth/google/login")).toBe(true);
    expect(isOAuthLoginPathname("/api/auth/x/callback")).toBe(false);
  });

  it("reads cap_native query flag", () => {
    const url = new URL("https://fintech-advisor.ai/api/auth/google/login?cap_native=1");
    expect(isCapNativeOAuthRequest(url)).toBe(true);
    expect(isCapNativeOAuthRequest(new URL("https://fintech-advisor.ai/api/auth/google/login"))).toBe(false);
  });

  it("appends cap_native=1 without duplicating", () => {
    expect(withCapNativeOAuthQuery("/api/auth/x/login?next=%2Fxchat")).toContain("cap_native=1");
    expect(withCapNativeOAuthQuery("https://fintech-advisor.ai/api/auth/x/login?cap_native=1")).toBe(
      "https://fintech-advisor.ai/api/auth/x/login?cap_native=1"
    );
  });

  it("builds and parses oauth-complete deep links", () => {
    const deepLink = buildCapacitorOAuthCompleteDeepLink("/xchat");
    expect(deepLink).toBe("com.atxfinance.ai://oauth-complete?next=%2Fxchat");
    expect(parseCapacitorOAuthCompleteDeepLink(deepLink)).toEqual({ nextPath: "/xchat" });
    expect(parseCapacitorOAuthCompleteDeepLink("https://evil.example/")).toBeNull();
    expect(parseCapacitorOAuthCompleteDeepLink("com.atxfinance.ai://oauth-complete?next=//evil")).toEqual({
      nextPath: "/xchat"
    });
  });
});

describe("Capacitor OAuth bootstrap wiring", () => {
  const ROOT = resolve(__dirname, "../..");

  it("pins browser-based OAuth interception in native shell", () => {
    const bootstrap = readFileSync(resolve(ROOT, "src/app/ui/capacitor-oauth-bootstrap-client.tsx"), "utf8");
    expect(bootstrap).toMatch(/isCapacitorNativePlatform/);
    expect(bootstrap).toMatch(/openOAuthLoginInCapacitorBrowser/);
    expect(bootstrap).toMatch(/isOAuthLoginPathname/);
  });

  it("routes successful native OAuth through capacitor-oauth-done bridge", () => {
    const finalize = readFileSync(resolve(ROOT, "src/lib/oauth-complete-session.ts"), "utf8");
    expect(finalize).toMatch(/consumeCapNativeOAuthCookie/);
    expect(finalize).toMatch(/CAPACITOR_OAUTH_DONE_PATH/);
  });
});
