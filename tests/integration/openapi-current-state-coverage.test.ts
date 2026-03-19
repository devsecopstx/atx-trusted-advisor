import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CURRENT_STATE_ROUTES } from "@/lib/openapi/current-state";

const METHOD_PATTERN = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;

type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

async function collectRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(absolutePath)));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(absolutePath);
    }
  }

  return files;
}

function toOpenApiPath(routeFilePath: string, apiRoot: string): string {
  const relativeDirectory = path
    .relative(apiRoot, path.dirname(routeFilePath))
    .split(path.sep)
    .filter(Boolean)
    .map((segment) => segment.replace(/\[([^\]]+)\]/g, "{$1}"))
    .join("/");

  return relativeDirectory.length > 0 ? `/api/${relativeDirectory}` : "/api";
}

function collectMethods(routeSource: string): RouteMethod[] {
  const methods = new Set<RouteMethod>();

  for (const match of routeSource.matchAll(METHOD_PATTERN)) {
    methods.add(match[1] as RouteMethod);
  }

  return [...methods].sort();
}

function toDocumentedRouteIndex(): Map<string, RouteMethod[]> {
  return new Map(
    CURRENT_STATE_ROUTES.map((route) => [
      route.path,
      route.operations.map((operation) => operation.method).sort()
    ])
  );
}

describe("current-state openapi inventory coverage", () => {
  it("documents every route handler and method", async () => {
    const apiRoot = path.join(process.cwd(), "src", "app", "api");
    const routeFiles = await collectRouteFiles(apiRoot);
    const discoveredRouteIndex = new Map<string, RouteMethod[]>();

    for (const routeFile of routeFiles) {
      const source = await readFile(routeFile, "utf8");
      const pathKey = toOpenApiPath(routeFile, apiRoot);
      discoveredRouteIndex.set(pathKey, collectMethods(source));
    }

    const documentedRouteIndex = toDocumentedRouteIndex();
    expect([...documentedRouteIndex.keys()].sort()).toEqual(
      [...discoveredRouteIndex.keys()].sort()
    );

    for (const [pathKey, discoveredMethods] of discoveredRouteIndex.entries()) {
      const documentedMethods = documentedRouteIndex.get(pathKey) ?? [];
      expect(documentedMethods).toEqual(discoveredMethods);
    }
  });
});
