/**
 * Composer dictation helper — normalizes browser / draft transcripts via the same BFF as multipart STT.
 * Mic capture + Web Speech sessions stay in `xchat-native-stt-client` / `xchat-dictation-client`.
 */

export async function normalizeComposerVoiceDraft(raw: string): Promise<string | null> {
  const t = raw.trim();
  if (t.length < 2) {
    return null;
  }
  try {
    const res = await fetch("/api/app-user/xchat/voice-transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcriptDraft: t })
    });
    const payload = (await res.json().catch(() => ({}))) as { data?: { transcript?: string } };
    const next = payload.data?.transcript;
    if (typeof next === "string" && next.trim()) {
      return next.trim();
    }
  } catch {
    /* keep draft */
  }
  return null;
}
