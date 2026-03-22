import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fileContains(path: string, needle: RegExp | string): boolean {
  const content = readFileSync(path, "utf8");
  if (typeof needle === "string") return content.includes(needle);
  return needle.test(content);
}

describe("docker-compose sanity", () => {
  const composePath = resolve(process.cwd(), "docker-compose.yml");

  it("contains services and expected service names", () => {
    expect(fileContains(composePath, /(?:^|\n)services:\s*\n/)).toBe(true);
    expect(fileContains(composePath, /\n\s{2}mongodb:\s*\n/)).toBe(true);
    expect(fileContains(composePath, /\n\s{2}atxfinance-backend:\s*\n/)).toBe(true);
  });

  it("exposes common ports for mongodb and backend", () => {
    // 27017 for Mongo, 8080 for backend (may be quoted or not)
    const content = readFileSync(composePath, "utf8");
    const hasMongoPort = /(\"?27017:27017\"?)/.test(content);
    const hasBackendPort = /(\"?8080:8080\"?)/.test(content);
    expect(hasMongoPort).toBe(true);
    expect(hasBackendPort).toBe(true);
  });

  it("defines a healthcheck for backend or depends_on condition", () => {
    const content = readFileSync(composePath, "utf8");
    const hasHealth = /healthcheck:\s*\n/.test(content);
    const hasDependsOnCond = /depends_on:\s*\n[\s\S]*condition: service_healthy/.test(content);
    expect(hasHealth || hasDependsOnCond).toBe(true);
  });
});
