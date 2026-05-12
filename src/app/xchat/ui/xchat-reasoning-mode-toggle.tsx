"use client";

import {
    XCHAT_DEPTH_MODE_GROUP_HINT,
    XCHAT_DEPTH_ROUTING_MODEL_LABELS,
    type XchatReasoningMode
} from "@/modules/xchat/xchat-reasoning-mode";

export type XchatReasoningModeToggleProps = {
  value: XchatReasoningMode;
  onChange: (next: XchatReasoningMode) => void;
  disabled?: boolean;
  /** Denser segmented control for inline composer toolbar */
  compact?: boolean;
};

const MODES: Array<{ id: XchatReasoningMode; label: string; hint: string }> = [
  { id: "fast", label: "Fast", hint: "Grok 4.1 Fast — lowest latency for this turn" },
  { id: "expert", label: "Expert", hint: "Grok 4.3 — medium reasoning effort" },
  { id: "heavy", label: "Heavy", hint: "Grok 4.3 — high reasoning effort" }
];

export function XchatReasoningModeToggle({
  value,
  onChange,
  disabled = false,
  compact = false
}: XchatReasoningModeToggleProps) {
  return (
    <div
      aria-label="Answer depth"
      className={`xchat-reasoning-mode${compact ? " xchat-reasoning-mode--compact" : ""}`}
      role="group"
    >
      <span className="xchat-reasoning-mode__label" title={XCHAT_DEPTH_MODE_GROUP_HINT}>
        Depth
      </span>
      <div className="xchat-reasoning-mode__segments">
        {MODES.map((m) => (
          <button
            key={m.id}
            aria-pressed={value === m.id}
            className={`xchat-reasoning-mode__seg${value === m.id ? " xchat-reasoning-mode__seg--active" : ""}`}
            disabled={disabled}
            title={m.hint}
            type="button"
            onClick={() => onChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="xchat-reasoning-mode__model-id" title={XCHAT_DEPTH_MODE_GROUP_HINT}>
        {XCHAT_DEPTH_ROUTING_MODEL_LABELS[value]}
      </span>
    </div>
  );
}
