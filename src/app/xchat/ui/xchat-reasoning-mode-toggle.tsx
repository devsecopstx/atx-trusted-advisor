"use client";

import type { XchatReasoningMode } from "@/modules/xchat/xchat-reasoning-mode";

export type XchatReasoningModeToggleProps = {
  value: XchatReasoningMode;
  onChange: (next: XchatReasoningMode) => void;
  disabled?: boolean;
  /** Denser segmented control for inline composer toolbar */
  compact?: boolean;
};

const MODES: Array<{ id: XchatReasoningMode; label: string; hint: string }> = [
  { id: "fast", label: "Fast", hint: "grok-4-1-fast — lowest latency (no depth preset)" },
  {
    id: "expert",
    label: "Expert",
    hint: "grok-4.3 — reasoning.effort medium (more thinking for analysis & tools)"
  },
  {
    id: "heavy",
    label: "Heavy",
    hint: "grok-4.3 — reasoning.effort high (deepest reasoning tokens)"
  }
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
      <span className="xchat-reasoning-mode__label">Depth</span>
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
    </div>
  );
}
