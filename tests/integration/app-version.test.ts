import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/app-version";

describe("app version", () => {
  it("matches package.json (canonical source for runtime label)", () => {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    const expected = pkg.version.trim();

    expect(APP_VERSION).toBe(expected);
    expect(APP_VERSION_LABEL).toBe(`v${expected}`);
  });
});
