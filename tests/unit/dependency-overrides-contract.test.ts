import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("dependency overrides (supply chain)", () => {
  it("declares @tootallnate/once override in package.json", () => {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      overrides?: Record<string, string>;
    };
    const v = pkg.overrides?.["@tootallnate/once"];
    expect(v).toBeDefined();
    expect(v).toMatch(/^[\^~]?3\./);
  });

  it("resolves @tootallnate/once to >=3.0.1 in package-lock.json", () => {
    const lockPath = path.join(process.cwd(), "package-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    const entry = Object.entries(lock.packages).find(
      ([k, meta]) => k.endsWith("node_modules/@tootallnate/once") && Boolean(meta?.version)
    );
    const ver = entry?.[1]?.version;
    expect(ver).toBeDefined();
    const [major, minor, patch] = ver!.split(".").map((n) => Number.parseInt(n, 10));
    expect(major >= 3 && (major > 3 || minor > 0 || patch >= 1)).toBe(true);
  });
});
