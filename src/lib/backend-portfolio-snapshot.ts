import {
    isBackendOriginSameAsRequestOrigin,
    shouldProxyPortfolioRequestsToBackend
} from "@/lib/backend-bff";
import { getAtxfinanceBackendOrigin } from "@/lib/env";
import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

function coerceWorkspacePreloadFromBackend(
  preload: unknown,
  portfolioIdHex: string,
  rev: number
): WorkspaceSnapshotPreload | null {
  if (!preload || typeof preload !== "object") {
    return null;
  }
  const p = preload as WorkspaceSnapshotPreload;
  if (
    !p.promptJson ||
    typeof p.promptJson.loadedAt !== "string" ||
    p.promptJson.workspaceContentRev !== rev ||
    p.promptJson.portfolio?.id !== portfolioIdHex ||
    !Array.isArray(p.positionsFull)
  ) {
    return null;
  }
  return p;
}

/**
 * Server-side read-through to Spring **`GET /api/portfolios/{portfolioId}/snapshot`** (Redis + Mongo on JVM).
 * Uses the same session cookie as the incoming Request. No-op when BFF is off or origin would self-proxy.
 */
export async function tryFetchBackendPortfolioWorkspaceSnapshot(input: {
  coordinatingRequest: Request;
  portfolioIdHex: string;
  workspaceContentRev: number;
}): Promise<WorkspaceSnapshotPreload | null> {
  if (!shouldProxyPortfolioRequestsToBackend()) {
    return null;
  }
  const base = getAtxfinanceBackendOrigin()?.trim().replace(/\/+$/, "");
  if (!base || isBackendOriginSameAsRequestOrigin(input.coordinatingRequest, base)) {
    return null;
  }
  const u = new URL(input.coordinatingRequest.url);
  const url = `${base}/api/portfolios/${encodeURIComponent(input.portfolioIdHex)}/snapshot?workspaceContentRev=${encodeURIComponent(String(input.workspaceContentRev))}`;
  const cookie = input.coordinatingRequest.headers.get("cookie");
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-forwarded-host": u.host,
        "x-forwarded-proto": u.protocol.replace(":", ""),
        ...(cookie ? { cookie } : {})
      },
      cache: "no-store"
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { data?: { preload?: unknown } };
    const preload = json.data?.preload;
    const coerced = coerceWorkspacePreloadFromBackend(
      preload,
      input.portfolioIdHex,
      input.workspaceContentRev
    );
    return coerced;
  } catch {
    return null;
  }
}
