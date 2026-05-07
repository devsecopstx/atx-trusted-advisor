import type { XaiResponsesReasoningOnly } from "@/lib/xai";

/** Grok-style composer presets → server `reasoningEffort` / multi-agent policy (see `POST /api/xchat/ask`). */
export type XchatReasoningMode = "fast" | "expert" | "heavy";

/** Depth toggle **Fast** — latency-first single-pass model (overrides persona `model` for that turn). */
export const XCHAT_DEPTH_FAST_MODEL_ID = "grok-4-1-fast" as const;

/** Depth toggles **Expert** / **Heavy** — `grok-4.3` + `reasoning.effort` on `/v1/responses` (no multi-agent parallelism). */
export const XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID = "grok-4.3" as const;

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

/** Expert-depth `reasoning.effort` for scheduled/options batch paths using **`grok-4.3`** (matches xChat Expert preset). */
export function expertResponsesReasoningForModelId(
  model: string
): XaiResponsesReasoningOnly | undefined {
  const m = model.trim().toLowerCase();
  if (m === "grok-4.3" || m.includes("grok-4.3")) {
    return { effort: "medium" };
  }
  return undefined;
}
