import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

export const HNWI_VISION_DESK_REPORT_V21_USER_DIRECTIVE =
  "Analyze this image in context of my current workspace holdings and watchlist. Output as HNWI Options Desk Report v2.1.";

function normalizePersonaNameKeyForHnwi(input: string): string {
  return input.trim().toLowerCase();
}

export function isHnwiPersonaName(personaName: string | undefined | null): boolean {
  const raw = personaName?.trim() ?? "";
  if (!raw) {
    return false;
  }
  const key = normalizePersonaNameKeyForHnwi(raw);
  return key.includes("hnwi") || raw.toLowerCase().includes("high net worth");
}

export function workspacePreloadHasHoldingsOrWatchlist(
  preload: WorkspaceSnapshotPreload | null | undefined
): boolean {
  if (!preload) {
    return false;
  }
  if (preload.positionsFull.length > 0) {
    return true;
  }
  const wl = preload.promptJson.watchlist;
  if (wl && "symbols" in wl && Array.isArray(wl.symbols)) {
    return wl.symbols.length > 0;
  }
  return false;
}

export function shouldInjectHnwiVisionDeskDirective(input: {
  hasVisionImages: boolean;
  personaName: string | undefined | null;
  hnwiSlug?: string | null;
  visionUseWorkspace: boolean;
  workspacePortfolioScoped: boolean;
  eagerWorkspacePreload: WorkspaceSnapshotPreload | null | undefined;
}): boolean {
  if (!input.hasVisionImages || !isHnwiPersonaName(input.personaName)) {
    return false;
  }
  const slug = input.hnwiSlug?.trim();
  if (slug) {
    return true;
  }
  if (workspacePreloadHasHoldingsOrWatchlist(input.eagerWorkspacePreload)) {
    return true;
  }
  if (input.visionUseWorkspace && input.workspacePortfolioScoped) {
    return true;
  }
  return false;
}
