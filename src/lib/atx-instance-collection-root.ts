/**
 * Instance-scoped xAI collection naming: RAG + strategy collections use `{root}-*` from seed;
 * per-user xChat history uses `{root}-chat-{userId}` when `ATX_INSTANCE_COLLECTION_ROOT` is set.
 */
export function resolveUserHistoryXaiCollectionDisplayName(userId: string): string {
  const root = process.env.ATX_INSTANCE_COLLECTION_ROOT?.trim();
  const uid = userId.trim().toLowerCase();
  if (root) {
    return `${root}-chat-${uid}`;
  }
  return `atx-chat-${uid}-history`;
}
