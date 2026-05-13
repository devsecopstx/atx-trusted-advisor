import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Static-content regression test: `POST /api/reports/options-scan` builds the
 * Python script path at runtime via `[…].join("/")` so Turbopack's NFT static
 * analyzer cannot follow a literal path string and over-trace the project.
 *
 * If this test breaks, restore the array-join (or another runtime construction)
 * and add the route to `STANDALONE_OUTPUT_FILE_TRACING_INCLUDES` in
 * `src/lib/next-build-policy.ts`. See `.cursor/agents/sre.md`.
 */

const ROUTE_FILE = resolve(
  __dirname,
  "../../src/app/api/reports/options-scan/route.ts"
);

describe("options-scan report path policy", () => {
  const source = readFileSync(ROUTE_FILE, "utf8");

  it("does not embed a literal `services/report-service/...` path string", () => {
    const literalMatches = source.match(/"services\/report-service\/[^"]+"/g) ?? [];
    expect(literalMatches).toEqual([]);
  });

  it("constructs the relative script path via array join (or env override)", () => {
    expect(source).toMatch(
      /\[\s*"services"\s*,\s*"report-service"\s*,\s*"options_scan_report\.py"\s*\]\s*\.join\(\s*"\/"\s*\)/
    );
  });

  it("references the standalone tracing policy comment for future contributors", () => {
    expect(source).toMatch(/outputFileTracingIncludes/);
  });
});
