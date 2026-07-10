import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the PWA service-worker policy that prevents stale UI in the Capacitor
 * iOS WebView (and other long-lived clients) when pointed at a local Next.js
 * dev server:
 *
 *   1. `PwaBootstrapClient` skips registration in development AND in the
 *      Capacitor native shell, actively unregistering workers + caches.
 *
 *   2. `public/sw.js` never SW-caches `/_next/**`. Those URLs are already
 *      content-hashed in production and served `cache-control: immutable`;
 *      the browser HTTP cache is the right layer for them.
 */

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("PwaBootstrapClient — dev/native unregister + prod browser register", () => {
  const source = readSource("src/app/ui/pwa-bootstrap-client.tsx");

  it("registers /sw.js only in production browsers (not dev, not Capacitor native)", () => {
    expect(source).toMatch(/isCapacitorNativePlatform/);
    expect(source).toMatch(/process\.env\.NODE_ENV !== "production" \|\| isNativeShell/);
    expect(source).toMatch(/navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  });

  it("unregisters service workers and clears caches in dev and Capacitor native", () => {
    expect(source).toMatch(/unregisterAllServiceWorkersAndCaches/);
  });
});

describe("usePwaInstallPrompt — hides install UI in Capacitor native shell", () => {
  const hookSource = readSource("src/app/ui/use-pwa-install-prompt.ts");
  const promptSource = readSource("src/app/ui/pwa-install-account-prompt.tsx");

  it("disables PWA install when Capacitor native platform is detected", () => {
    expect(hookSource).toMatch(/isCapacitorNativePlatform/);
    expect(hookSource).toMatch(/promptSupported = !isNativeShell/);
    expect(promptSource).toMatch(/if \(isNativeShell\)/);
    expect(promptSource).toMatch(/return null/);
  });
});

describe("public/sw.js — never SW-caches Next.js build output", () => {
  const source = readSource("public/sw.js");

  it("bumps STATIC_CACHE to invalidate the previous v3 cache", () => {
    expect(source).toMatch(/const STATIC_CACHE = "xf-static-v4"/);
  });

  it("bypasses /_next/** so the browser HTTP cache owns hashed chunks", () => {
    expect(source).toMatch(/url\.pathname\.startsWith\("\/_next\/"\)/);
  });
});

describe("ios Info.plist — App Store native requirements", () => {
  const plist = readSource("ios/App/App/Info.plist");

  it("declares microphone usage for xChat voice", () => {
    expect(plist).toMatch(/NSMicrophoneUsageDescription/);
  });

  it("requires arm64 (not legacy armv7)", () => {
    expect(plist).toMatch(/<string>arm64<\/string>/);
    expect(plist).not.toMatch(/armv7/);
  });
});
