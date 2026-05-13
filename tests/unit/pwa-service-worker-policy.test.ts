import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the PWA service-worker policy that prevents stale UI in the Capacitor
 * iOS WebView (and other long-lived clients) when pointed at a local Next.js
 * dev server:
 *
 *   1. `PwaBootstrapClient` skips registration in development AND actively
 *      unregisters any previously-installed worker + clears its caches —
 *      otherwise installed devices keep serving the cached old chunks
 *      forever (dev chunks have stable filenames).
 *
 *   2. `public/sw.js` never SW-caches `/_next/**`. Those URLs are already
 *      content-hashed in production and served `cache-control: immutable`;
 *      the browser HTTP cache is the right layer for them.
 */

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("PwaBootstrapClient — dev unregister + prod register", () => {
  const source = readSource("src/app/ui/pwa-bootstrap-client.tsx");

  it("only registers /sw.js when NODE_ENV === 'production'", () => {
    expect(source).toMatch(/process\.env\.NODE_ENV !== "production"/);
    expect(source).toMatch(/navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  });

  it("in dev, unregisters existing service workers and clears caches", () => {
    expect(source).toMatch(/navigator\.serviceWorker\.getRegistrations\(\)/);
    expect(source).toMatch(/\.unregister\(\)/);
    expect(source).toMatch(/caches\.keys\(\)/);
    expect(source).toMatch(/caches\.delete\(/);
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
