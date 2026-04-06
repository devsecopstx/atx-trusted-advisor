export const XCHAT_STRATEGY_HANDOFF_STORAGE_KEY = "xchat_strategy_handoff_v1";
export const XCHAT_SJP_LAST_CHOICE_KEY = "xchat_sjp_last_choice";

export type XchatStrategyHandoffStored = {
  v: 1;
  jobId: string;
  transcript: string;
  savedAt: number;
};

export type XchatSjpLastChoice = "launch" | "stay";

export function formatThreadForStrategyHandoff(
  messages: Array<{ role: string; content: string; strategyJobOffer?: boolean }>
): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`You:\n${m.content.trim()}`);
    } else if (m.role === "ai") {
      const body = m.strategyJobOffer
        ? "[Structured planning options were offered in chat — see xChat for your selection.]"
        : m.content.trim();
      lines.push(`Advisor:\n${body}`);
    }
  }
  return lines.join("\n\n---\n\n");
}

export function writeStrategyHandoffFromXchat(
  jobId: string,
  messages: Array<{ role: string; content: string; strategyJobOffer?: boolean }>
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const transcript = formatThreadForStrategyHandoff(messages);
  const payload: XchatStrategyHandoffStored = { v: 1, jobId, transcript, savedAt: Date.now() };
  try {
    sessionStorage.setItem(XCHAT_STRATEGY_HANDOFF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function readStrategyHandoffForJob(jobId: string): XchatStrategyHandoffStored | null {
  if (typeof sessionStorage === "undefined" || !jobId) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(XCHAT_STRATEGY_HANDOFF_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<XchatStrategyHandoffStored>;
    if (parsed?.v !== 1 || parsed.jobId !== jobId || typeof parsed.transcript !== "string") {
      return null;
    }
    return {
      v: 1,
      jobId: parsed.jobId,
      transcript: parsed.transcript,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now()
    };
  } catch {
    return null;
  }
}

export function clearStrategyHandoffStorage(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(XCHAT_STRATEGY_HANDOFF_STORAGE_KEY);
  } catch {
    // ignore
  }
}
