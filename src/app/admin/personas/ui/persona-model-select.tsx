"use client";

import {
    XAI_DOCS_MODELS_URL,
    XAI_PERSONA_CHAT_MODEL_OPTIONS,
    isKnownPersonaChatModelId
} from "@/modules/xchat/xai-persona-chat-models";

const CUSTOM_VALUE = "__custom__";

type PersonaModelSelectProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (modelId: string) => void;
  required?: boolean;
};

export function PersonaModelSelect({
  id,
  name,
  value,
  onChange,
  required
}: PersonaModelSelectProps) {
  const trimmed = value.trim();
  const isPreset = isKnownPersonaChatModelId(trimmed);
  const selectValue = isPreset ? trimmed : CUSTOM_VALUE;

  return (
    <div className="stack-gap">
      <label className="status-text" htmlFor={id ? `${id}-preset` : undefined}>
        xAI model — token $/1M from{" "}
        <a
          className="underline decoration-[var(--xf-gain-green)] decoration-1 underline-offset-2"
          href={XAI_DOCS_MODELS_URL}
          rel="noreferrer"
          target="_blank"
        >
          docs.x.ai/models
        </a>
        {" "}(effective $/hr depends on tokens + tools)
      </label>
      <select
        aria-label="xAI model preset"
        id={id ? `${id}-preset` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          if (next === CUSTOM_VALUE) {
            onChange("");
          } else {
            onChange(next);
          }
        }}
        required={required && isPreset}
        value={selectValue}
      >
        {XAI_PERSONA_CHAT_MODEL_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label} — {opt.pricingPerMillionUsd}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Custom model id…</option>
      </select>
      {!isPreset ? (
        <input
          maxLength={128}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Custom model id (e.g. grok-4-latest)"
          required={required}
          value={value}
        />
      ) : null}
    </div>
  );
}
