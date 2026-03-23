/**
 * Client-safe sync helpers for XAI_TEAM_ID.
 * No dynamic imports — safe for Client Components (xchat-conversation, etc.).
 * Server-side resolution: use resolveTeamKbCollectionId from team-xai-collection.
 */
const XAI_KB_COLLECTION_ID_RE = /^collection_[A-Za-z0-9_-]+$/;

export function readRawXaiTeamId(): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  const raw = process.env.XAI_TEAM_ID?.trim();
  return raw || undefined;
}

export function getTeamXaiKbCollectionIdSync(): string | undefined {
  const raw = readRawXaiTeamId();
  if (!raw || !XAI_KB_COLLECTION_ID_RE.test(raw)) {
    return undefined;
  }
  return raw;
}
