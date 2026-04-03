import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BFF_PROXY_ROUTES, type BffProxyRoute } from "@/lib/bff-proxy-routes";

const REPO_ROOT = process.cwd();

/**
 * `/api/foo/{bar}/baz` → `src/app/api/foo/[bar]/baz/route.ts`
 */
function bffTemplatePathToRouteFileAbs(templatePath: string): string {
  const trimmed = templatePath.replace(/^\/+/, "");
  const segments = trimmed.split("/");
  if (segments[0] !== "api") {
    throw new Error(`Expected /api prefix: ${templatePath}`);
  }
  const appSegments = segments.slice(1).map((seg) => {
    if (seg.startsWith("{") && seg.endsWith("}")) {
      return `[${seg.slice(1, -1)}]`;
    }
    return seg;
  });
  return resolve(REPO_ROOT, "src", "app", "api", ...appSegments, "route.ts");
}

const PROXY_CALL_RE =
  /await (proxyRequestToBackend|proxyPortfolioRequestToBackend|proxyAdminUsersRequestToBackend|proxyAdminScheduledTasksRequestToBackend|proxyAdminDeliveryChannelsRequestToBackend|proxyPersonasRequestToBackend)\(/g;

describe("BFF_PROXY_ROUTES ↔ Next route handlers", () => {
  it("every registry path maps to a route.ts that proxies to the backend at least once per registered method", () => {
    const routesByFile = new Map<string, BffProxyRoute[]>();

    for (const route of BFF_PROXY_ROUTES) {
      const abs = bffTemplatePathToRouteFileAbs(route.path);
      const list = routesByFile.get(abs) ?? [];
      list.push(route);
      routesByFile.set(abs, list);
    }

    for (const [absFile, routes] of routesByFile) {
      expect(existsSync(absFile), `Missing Next handler for BFF routes: ${routes.map((r) => `${r.method} ${r.path}`).join("; ")} → ${absFile}`).toBe(
        true
      );

      const source = readFileSync(absFile, "utf8");
      expect(
        /proxyRequestToBackend|proxyPortfolioRequestToBackend|proxyAdminUsersRequestToBackend|proxyAdminScheduledTasksRequestToBackend|proxyAdminDeliveryChannelsRequestToBackend|proxyPersonasRequestToBackend/.test(source),
        `${absFile}: expected a backend-bff proxy import/call`
      ).toBe(true);
      const proxyCalls = (source.match(PROXY_CALL_RE) ?? []).length;
      expect(
        proxyCalls,
        `${absFile}: need >= ${routes.length} proxy call(s) for ${routes.map((r) => r.method).join(",")}, found ${proxyCalls}`
      ).toBeGreaterThanOrEqual(routes.length);
    }
  });
});
