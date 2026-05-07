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
  { id: "fast", label: "Fast", hint: "Single-pass — lowest latency" },
  { id: "expert", label: "Expert", hint: "Deeper reasoning — up to 4 parallel agents on eligible plans" },
  { id: "heavy", label: "Heavy", hint: "Maximum depth — up to 16 parallel agents on Premium+" }
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
