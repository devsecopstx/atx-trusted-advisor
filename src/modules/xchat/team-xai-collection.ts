import {
    getTeamXaiKbCollectionIdSync as getSync,
    readRawXaiTeamId as readRaw
} from "./team-xai-collection-sync";

/** Re-export for server modules that also need resolveTeamKbCollectionId. */
export { getTeamXaiKbCollectionIdSync, readRawXaiTeamId } from "./team-xai-collection-sync";

/**
 * Resolves the team KB collection id: direct `collection_*` from `XAI_TEAM_ID`, or first collection
 * for that team via the management API when `XAI_TEAM_ID` is a team UUID.
 */
export async function resolveTeamKbCollectionId(): Promise<string | undefined> {
  const sync = getSync();
  if (sync) {
    return sync;
  }
  const raw = readRaw();
  if (!raw) {
    return undefined;
  }
  const { listXaiCollections } = await import("@/lib/xai");
  const cols = await listXaiCollections({ teamId: raw });
  return cols[0]?.id;
}
