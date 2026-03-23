const XAI_KB_COLLECTION_ID_RE = /^collection_[A-Za-z0-9_-]+$/;

/**
 * Raw `XAI_TEAM_ID` from the environment (team UUID or `collection_*` KB id).
 * Uses `process.env` only — safe for client bundles (value is absent unless `NEXT_PUBLIC_*`).
 */
export function readRawXaiTeamId(): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  const raw = process.env.XAI_TEAM_ID?.trim();
  return raw || undefined;
}

/**
 * When `XAI_TEAM_ID` is already a xAI **collection** id (`collection_*`), use it as the team KB
 * collection for tools and UI. When it is a **team** UUID, returns `undefined` — call
 * {@link resolveTeamKbCollectionId} on the server to list collections and pick one.
 */
export function getTeamXaiKbCollectionIdSync(): string | undefined {
  const raw = readRawXaiTeamId();
  if (!raw || !XAI_KB_COLLECTION_ID_RE.test(raw)) {
    return undefined;
  }
  return raw;
}

/**
 * Resolves the team KB collection id: direct `collection_*` from `XAI_TEAM_ID`, or first collection
 * for that team via the management API when `XAI_TEAM_ID` is a team UUID.
 */
export async function resolveTeamKbCollectionId(): Promise<string | undefined> {
  const sync = getTeamXaiKbCollectionIdSync();
  if (sync) {
    return sync;
  }
  const raw = readRawXaiTeamId();
  if (!raw) {
    return undefined;
  }
  const { listXaiCollections } = await import("@/lib/xai");
  const cols = await listXaiCollections({ teamId: raw });
  return cols[0]?.id;
}
