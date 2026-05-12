/**
 * Grok-style composer presets → `POST /api/xchat/ask` routing.
 * Depth uses **`grok-4.3`** with xAI Responses **`reasoning.effort`** (same semantics as vendor `reasoning_effort` on grok-4.3).
 * @see https://docs.x.ai/developers/model-capabilities/text/reasoning#the-reasoning_effort-parameter
 */
export type XchatReasoningMode = "fast" | "expert" | "heavy";

/** Depth toggle **Fast** — latency-first single-pass model (overrides persona `model` for that turn). */
export const XCHAT_DEPTH_FAST_MODEL_ID = "grok-4-1-fast" as const;

/** Depth toggles **Expert** / **Heavy** — `grok-4.3` + `reasoning.effort` on `/v1/responses` (no multi-agent parallelism). */
export const XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID = "grok-4.3" as const;

export const XCHAT_REASONING_MODE_STORAGE_KEY = "xf_xchat_reasoning_mode";

export const XCHAT_DEPTH_ROUTING_MODEL_LABELS: Record<XchatReasoningMode, string> = {
  fast: "Grok 4.1 Fast",
  expert: "Grok 4.3",
  heavy: "Grok 4.3"
};

/** User-facing model label for the composer Depth preset (matches ask-route overrides). */
export function xchatDepthRoutingModelLabel(mode: XchatReasoningMode): string {
  return XCHAT_DEPTH_ROUTING_MODEL_LABELS[mode];
}

export const XCHAT_DEPTH_MODE_GROUP_HINT =
  "Fast = Grok 4.1 Fast · Expert = Grok 4.3 (medium reasoning) · Heavy = Grok 4.3 (high reasoning)";

/** Legacy body control; includes **`none`** for grok-4.3 (disables reasoning per xAI docs). */
export type RequestedReasoningEffortInput = "none" | "low" | "medium" | "high" | "xhigh";

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

export type XchatResponsesReasoningEffort = "none" | "low" | "medium" | "high";

/** Expert-depth `reasoning.effort` for scheduled/options batch paths using **`grok-4.3`** (matches xChat Expert preset). */
export function expertResponsesReasoningForModelId(
  model: string
): { effort: XchatResponsesReasoningEffort } | undefined {
  const m = model.trim().toLowerCase();
  if (m === "grok-4.3" || m.includes("grok-4.3")) {
    return { effort: "medium" };
  }
  return undefined;
}
