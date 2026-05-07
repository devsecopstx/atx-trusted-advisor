import type { ToolExecutor, XaiResponsesReasoningOnly } from "@/lib/xai";
import { personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import { getPersonaByNormalizedName } from "@/modules/xchat/repository";
import type { PersonaConfig, PersonaXapiToolChoice } from "@/modules/xchat/types";
import { normalizePersonaXapiConfig } from "@/modules/xchat/types";
import {
    expertResponsesReasoningForModelId,
    XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID
} from "@/modules/xchat/xchat-reasoning-mode";

/** Default xPersona **name** (Mongo `nameNormalized`) for `options_scanner` Grok refinement. */
export const OPTIONS_SCANNER_DEFAULT_PERSONA_NAME = "finance-advisor";

const SCANNER_OUTPUT_CONTRACT = `Scanner refinement (this turn only):
You are refining a single listed option leg using desk rules + chain fields already provided in the user JSON.
Reply with JSON only, no markdown: {"action":"hold"|"sell","rationale":"max 500 chars","confidence":0-100}.
action "sell" means recommend closing the position (buy to close if short premium, sell to close if long).
Educational only; not financial advice. Prefer the structured ruleSuggestion unless chain evidence clearly overrides.`;

export type OptionsScannerPersonaContext = {
  systemPrompt: string;
  model: string;
  temperature: number;
  tools: Array<Record<string, unknown>>;
  toolChoice: PersonaXapiToolChoice;
  maxTurns: number;
  /** Set when `model` is **`grok-4.3`** — forwarded to `/v1/responses` (and chat completions when used). */
  responsesReasoning?: XaiResponsesReasoningOnly;
};

function isPersonaAllowedForScheduledScanner(persona: PersonaConfig): boolean {
  const s = persona.status;
  if (s === "draft" || s === "archived") {
    return false;
  }
  return true;
}

function defaultOptionsScannerModel(): string {
  const override = process.env.OPTIONS_SCANNER_MODEL?.trim();
  if (override && override.length > 0) {
    return override.slice(0, 128);
  }
  return XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID;
}

/**
 * Loads a **published** (or legacy unset-status) xPersona by **display name** for options_scanner Grok passes.
 * Returns null if missing, disallowed status, or persona tools cannot be normalized.
 */
export async function resolveOptionsScannerPersonaContext(): Promise<OptionsScannerPersonaContext | null> {
  const raw = (process.env.OPTIONS_SCANNER_PERSONA_NAME ?? OPTIONS_SCANNER_DEFAULT_PERSONA_NAME).trim();
  const key = raw.toLowerCase();
  if (!key) {
    return null;
  }
  const persona = await getPersonaByNormalizedName(key);
  if (!persona?._id || !isPersonaAllowedForScheduledScanner(persona)) {
    return null;
  }
  const xapi = normalizePersonaXapiConfig(persona.xapi);
  const tools = personaXapiToolsToXaiRequestTools(xapi.tools);
  const systemPrompt = [persona.systemPrompt.trim(), persona.overridePrompt?.trim(), SCANNER_OUTPUT_CONTRACT]
    .filter((x) => x.length > 0)
    .join("\n\n");
  const model = persona.model?.trim() || defaultOptionsScannerModel();
  const responsesReasoning = expertResponsesReasoningForModelId(model);
  const temperature =
    typeof persona.temperature === "number" && Number.isFinite(persona.temperature)
      ? persona.temperature
      : 0.15;
  return {
    systemPrompt,
    model,
    temperature,
    tools,
    toolChoice: xapi.toolChoice,
    maxTurns: xapi.maxTurns,
    responsesReasoning
  };
}

/**
 * Local tool execution for scheduled options_scanner: Yahoo quotes work without a user session;
 * `atx_function` has no signed-in workspace in this job — return a structured error so the model
 * falls back to the JSON contract fields.
 */
export function createOptionsScannerToolExecutor(): ToolExecutor {
  return async (name, args) => {
    const n = name.trim().toLowerCase();
    if (n === "yahoo_finance") {
      try {
        const symbol = typeof args.symbol === "string" ? args.symbol : undefined;
        const q = await getYahooMarketQuote({ symbol });
        return { result: JSON.stringify(q) };
      } catch (e) {
        return {
          result: "",
          error: e instanceof Error ? e.message : "yahoo_finance_error"
        };
      }
    }
    if (n === "atx_function") {
      return {
        result: JSON.stringify({
          error: "options_scanner_no_workspace",
          message:
            "Scheduled options_scanner has no signed-in user. Use ruleSuggestion and contract fields in the user message only; do not rely on portfolio or watchlist tools."
        })
      };
    }
    return {
      result: JSON.stringify({ error: "unknown_tool", name }),
      error: `unknown_tool:${name}`
    };
  };
}
