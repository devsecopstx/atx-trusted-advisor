/** sessionStorage key: one-shot composer prefill when navigating from another surface (e.g. xOptions). */
export const XCHAT_PENDING_PROMPT_STORAGE_KEY = "xf_xchat_pending_prompt_v1";

/** sessionStorage key: prefer a published persona by Mongo `name` when xChat mounts (e.g. portfolios desk). */
export const XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY = "xf_xchat_pending_persona_name_v1";

/** Default advisor persona `name` on published xPersona docs — used when linking from /portfolios. */
export const XCHAT_PORTFOLIOS_DESK_ADVISOR_PERSONA_NAME = "finance-advisor";

export type XchatPendingComposerHandoff = {
  prompt: string;
  personaName: string | null;
};

let pendingComposerHandoffMemory: XchatPendingComposerHandoff | null = null;

function readPendingComposerHandoffFromSession(): XchatPendingComposerHandoff {
  if (typeof window === "undefined") {
    return { prompt: "", personaName: null };
  }
  try {
    const prompt = sessionStorage.getItem(XCHAT_PENDING_PROMPT_STORAGE_KEY)?.trim() ?? "";
    const personaName = sessionStorage.getItem(XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY)?.trim() ?? "";
    if (prompt) {
      sessionStorage.removeItem(XCHAT_PENDING_PROMPT_STORAGE_KEY);
    }
    if (personaName) {
      sessionStorage.removeItem(XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY);
    }
    return {
      prompt,
      personaName: personaName || null
    };
  } catch {
    return { prompt: "", personaName: null };
  }
}

/** One-shot composer handoff for the current xChat mount (survives React Strict Mode remount). */
export function consumeXchatPendingComposerHandoff(): XchatPendingComposerHandoff {
  if (pendingComposerHandoffMemory) {
    return pendingComposerHandoffMemory;
  }
  const next = readPendingComposerHandoffFromSession();
  if (next.prompt || next.personaName) {
    pendingComposerHandoffMemory = next;
  }
  return next;
}

export function clearXchatPendingComposerHandoffMemory(): void {
  pendingComposerHandoffMemory = null;
}

export function writeXchatPendingComposerHandoff(input: {
  prompt: string;
  personaName?: string | null;
}): void {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return;
  }
  const personaName = input.personaName?.trim() ?? "";
  pendingComposerHandoffMemory = {
    prompt,
    personaName: personaName || null
  };
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(XCHAT_PENDING_PROMPT_STORAGE_KEY, prompt);
    if (personaName) {
      sessionStorage.setItem(XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY, personaName);
    } else {
      sessionStorage.removeItem(XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}
