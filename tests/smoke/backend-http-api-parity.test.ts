import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const BACKEND_KOTLIN_MAIN = resolve(REPO_ROOT, "services/atxfinance-backend/src/main/kotlin");
const SPEC_PATH = resolve(REPO_ROOT, "docs/ops/atxfinance-backend-http-api.md");

/** Routes that must stay declared in Kotlin controllers and documented in the HTTP spec. */
const REQUIRED_GET_ROUTES = ["/api/health", "/api/backend/health"] as const;

function readTreeFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, name.name);
    if (name.isDirectory()) readTreeFiles(p, acc);
    else if (name.isFile() && name.name.endsWith(".kt")) acc.push(p);
  }
  return acc;
}

describe("atxfinance-backend HTTP API parity (docs ↔ Kotlin)", () => {
  it("spec file exists and lists required routes", () => {
    const spec = readFileSync(SPEC_PATH, "utf8");
    for (const route of REQUIRED_GET_ROUTES) {
      expect(spec).toContain(route);
    }
    expect(spec).toContain("/actuator/health");
    expect(spec).toContain("/v3/api-docs");
  });

  it("Kotlin controllers still expose required @GetMapping paths", () => {
    const files = readTreeFiles(BACKEND_KOTLIN_MAIN);
    const combined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    for (const route of REQUIRED_GET_ROUTES) {
      const needle = `@GetMapping("${route}")`;
      expect(combined.includes(needle), `Missing ${needle} under services/atxfinance-backend/src/main/kotlin`).toBe(
        true
      );
    }
  });
});
