import type { XchatUserPromptTemplatePublic } from "@/modules/xchat/xchat-user-prompt-templates-repository";

const DEFAULT_TTL_MS = 30_000;

const store = new Map<string, { expiresAt: number; value: XchatUserPromptTemplatePublic[] }>();

function cloneTemplates(rows: XchatUserPromptTemplatePublic[]): XchatUserPromptTemplatePublic[] {
  return rows.map((t) => ({ ...t }));
}

/**
 * In-process list cache for `GET /api/app-user/xchat/prompt-templates` (per user, short TTL).
 * Bust on successful template create/delete so the strip stays fresh without hammering Mongo.
 */
export async function getUserPromptTemplatesListWithServerCache(
  userIdHex: string,
  loader: () => Promise<XchatUserPromptTemplatePublic[]>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<XchatUserPromptTemplatePublic[]> {
  const now = Date.now();
  const hit = store.get(userIdHex);
  if (hit && hit.expiresAt > now) {
    return cloneTemplates(hit.value);
  }
  const fresh = await loader();
  const value = cloneTemplates(fresh);
  store.set(userIdHex, { expiresAt: now + ttlMs, value });
  return cloneTemplates(value);
}

export function bustUserPromptTemplatesListServerCache(userIdHex: string): void {
  store.delete(userIdHex);
}

export function resetUserPromptTemplatesListServerCacheForTests(): void {
  store.clear();
}
