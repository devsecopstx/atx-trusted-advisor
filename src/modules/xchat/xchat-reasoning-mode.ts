/** Grok-style composer presets → server `reasoningEffort` / multi-agent policy (see `POST /api/xchat/ask`). */
export type XchatReasoningMode = "fast" | "expert" | "heavy";

export const XCHAT_REASONING_MODE_STORAGE_KEY = "xf_xchat_reasoning_mode";

export type RequestedReasoningEffortInput = "low" | "medium" | "high" | "xhigh";

/**
 * `reasoningMode` wins when set; otherwise passes through `reasoningEffort`.
 * `fast` clears effort so multi-agent personas can downgrade for simple turns.
 */
export function resolveReasoningEffortFromAskPayload(input: {
  reasoningMode?: XchatReasoningMode;
  reasoningEffort?: RequestedReasoningEffortInput;
}): RequestedReasoningEffortInput | undefined {
  if (input.reasoningMode === "fast") {
    return undefined;
  }
  if (input.reasoningMode === "expert") {
    return "medium";
  }
  if (input.reasoningMode === "heavy") {
    return "high";
  }
  return input.reasoningEffort;
}
