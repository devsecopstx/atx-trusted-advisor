/**
 * Instance-scoped xAI collection naming: RAG + strategy root bucket `{root}-xoption-<env>` from seed;
 * per-user xChat history uses `{root}-chat-{userId}` when a valid tenant prefix is set.
 *
 * **ATX_INSTANCE_COLLECTION_ROOT** must be the same **namespace prefix** as seed’s
 * `atxInstanceCollectionRoot` (e.g. `atx-stage-atx-fintech-advisor`). Do **not** set it to:
 * - an xAI **collection id** (`collection_…`) — those are API handles, not the tenant prefix;
 * - the team KB **display name** (`{root}-rag`) — chat history would become `{root}-rag-chat-…` (wrong).
 */
const XAI_COLLECTION_ID_RE = /^collection_[A-Za-z0-9_-]+$/;

/**
 * Normalized tenant namespace for xChat history and naming alignment with seed.
 * Returns `undefined` when unset, mistaken `collection_*`, or empty after stripping `-rag`.
 */
export function resolveNormalizedAtxInstanceCollectionRoot(): string | undefined {
  const raw = process.env.ATX_INSTANCE_COLLECTION_ROOT?.trim();
  if (!raw) {
    return undefined;
  }
  if (XAI_COLLECTION_ID_RE.test(raw)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[atx-instance-collection-root] ATX_INSTANCE_COLLECTION_ROOT looks like an xAI collection id; ignoring. Use the tenant prefix from seed JSON `atxInstanceCollectionRoot` (e.g. atx-stage-my-site), not collection_*."
      );
    }
    return undefined;
  }
  let t = raw;
  if (t.toLowerCase().endsWith("-rag")) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[atx-instance-collection-root] ATX_INSTANCE_COLLECTION_ROOT ends with -rag; stripping. Root is the prefix only; team KB display name is {root}-rag."
      );
    }
    t = t.slice(0, -4).replace(/-+$/, "").trim();
  }
  return t || undefined;
}

export function resolveUserHistoryXaiCollectionDisplayName(userId: string): string {
  const root = resolveNormalizedAtxInstanceCollectionRoot();
  const uid = userId.trim().toLowerCase();
  if (root) {
    return `${root}-chat-${uid}`;
  }
  return `atx-chat-${uid}-history`;
}
