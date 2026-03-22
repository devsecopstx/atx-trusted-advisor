/**
 * Curated xChat persona models with token pricing from
 * https://docs.x.ai/docs/models (snapshot Mar 2026). Image/video models omitted.
 * Aliases may bill per console routing — notes call that out.
 */
export const XAI_DOCS_MODELS_URL = "https://docs.x.ai/docs/models";

/** Matches `XAI_CHAT_MODEL` / ask-route fallback when env is unset. */
export const XAI_PERSONA_CHAT_MODEL_FALLBACK_ID = "grok-4.20-multi-agent-0309";

export type XaiPersonaChatModelOption = {
  id: string;
  label: string;
  /** Per xAI docs: $/1M input (cached in parens) / $/1M output */
  pricingPerMillionUsd: string;
};

const OPTIONS: XaiPersonaChatModelOption[] = [
  {
    id: "grok-4-1-fast-reasoning",
    label: "Grok 4.1 fast (reasoning, tools)",
    pricingPerMillionUsd: "$0.20 ($0.05) / $0.50 in·out"
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    label: "Grok 4.1 fast (non-reasoning, tools)",
    pricingPerMillionUsd: "$0.20 ($0.05) / $0.50 in·out"
  },
  {
    id: "grok-4-1-fast",
    label: "grok-4-1-fast (alias)",
    pricingPerMillionUsd: "~4.1 fast tier — confirm in xAI console"
  },
  {
    id: "grok-4-latest",
    label: "grok-4-latest (alias)",
    pricingPerMillionUsd: "Follows current Grok-4 release — see console"
  },
  {
    id: "grok-4.20-0309-non-reasoning",
    label: "Grok 4.20 0309 (non-reasoning)",
    pricingPerMillionUsd: "$2.00 ($0.20) / $6.00 in·out"
  },
  {
    id: "grok-4.20-0309-reasoning",
    label: "Grok 4.20 0309 (reasoning)",
    pricingPerMillionUsd: "$2.00 ($0.20) / $6.00 in·out"
  },
  {
    id: "grok-4.20-multi-agent",
    label: "Grok 4.20 multi-agent (xChat parallel)",
    pricingPerMillionUsd: "$2.00 ($0.20) / $6.00 in·out + tool surcharges"
  },
  {
    id: "grok-4.20-multi-agent-0309",
    label: "Grok 4.20 multi-agent 0309",
    pricingPerMillionUsd: "$2.00 ($0.20) / $6.00 in·out + tool surcharges"
  }
];

export const XAI_PERSONA_CHAT_MODEL_OPTIONS: readonly XaiPersonaChatModelOption[] = OPTIONS;

const KNOWN_IDS = new Set(OPTIONS.map((o) => o.id));

export function isKnownPersonaChatModelId(modelId: string): boolean {
  return KNOWN_IDS.has(modelId.trim());
}
