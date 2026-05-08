let activeMessageId: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const cb of listeners) {
    cb();
  }
}

/** Subscribe for React useSyncExternalStore (client-only). */
export function subscribeXchatSpeechPlayback(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getXchatSpeechPlaybackActiveMessageId(): string | null {
  return activeMessageId;
}

/** Marks which assistant bubble owns the current utterance (replaces any prior id). */
export function setXchatSpeechPlaybackActiveMessageId(messageId: string): void {
  activeMessageId = messageId;
  emit();
}

/** Clears active id when playback ends, errors, or user stops — only if still this message. */
export function clearXchatSpeechPlaybackIfMessage(messageId: string): void {
  if (activeMessageId === messageId) {
    activeMessageId = null;
    emit();
  }
}
