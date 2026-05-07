import { respondWithXai, respondWithXaiToolLoop } from "@/lib/xai";
import { personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";
import {
    createOptionsScannerToolExecutor,
    type OptionsScannerPersonaContext
} from "@/modules/strategy-options/options-scanner-persona";
import { getPersonaByNormalizedName } from "@/modules/xchat/repository";
import type { PersonaConfig } from "@/modules/xchat/types";
import { normalizePersonaXapiConfig } from "@/modules/xchat/types";
import {
    expertResponsesReasoningForModelId,
    XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID
} from "@/modules/xchat/xchat-reasoning-mode";

/** Default xPersona **name** (Mongo `nameNormalized`) for `watchlist_price_scanner` Grok rationale pass. */
export const WATCHLIST_SCANNER_DEFAULT_PERSONA_NAME = "finance-advisor";

const WATCHLIST_SCANNER_OUTPUT_CONTRACT = `Watchlist price-scan turn (scheduled batch job, no signed-in user):
You receive JSON with symbol, spotPrice, optional priorRationale, lineType, strategy.
Reply with JSON only, no markdown: {"rationale":"max 380 chars — one desk sentence on whether the line still fits spot; educational only; not financial advice."}.
If data is thin, return a neutral one-liner referencing spot only.`;

export type WatchlistScannerPersonaContext = OptionsScannerPersonaContext;

function isPersonaAllowedForScheduledScanner(persona: PersonaConfig): boolean {
  const s = persona.status;
  if (s === "draft" || s === "archived") {
    return false;
  }
  return true;
}

function defaultWatchlistScannerModel(): string {
  const override = process.env.WATCHLIST_SCANNER_MODEL?.trim();
  if (override && override.length > 0) {
    return override.slice(0, 128);
  }
  return XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID;
}

/**
 * Loads a **published** xPersona by **display name** for watchlist_price_scanner Grok rationale.
 * Same wiring as options_scanner (`finance-advisor` by default); env overrides name / disable.
 */
export async function resolveWatchlistScannerPersonaContext(): Promise<WatchlistScannerPersonaContext | null> {
  const raw = (process.env.WATCHLIST_SCANNER_PERSONA_NAME ?? WATCHLIST_SCANNER_DEFAULT_PERSONA_NAME).trim();
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
  const systemPrompt = [persona.systemPrompt.trim(), persona.overridePrompt?.trim(), WATCHLIST_SCANNER_OUTPUT_CONTRACT]
    .filter((x) => x.length > 0)
    .join("\n\n");
  const model = persona.model?.trim() || defaultWatchlistScannerModel();
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

function parseWatchlistRowRationaleJson(text: string): string | null {
  const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
  let json: { rationale?: string };
  try {
    json = JSON.parse(cleaned) as { rationale?: string };
  } catch {
    return null;
  }
  const r = typeof json.rationale === "string" ? json.rationale.trim().slice(0, 380) : "";
  return r.length > 0 ? r : null;
}

/**
 * Single-row Grok refinement using the resolved persona (yahoo_finance / stub atx_function executor).
 */
export async function refineWatchlistRowRationaleWithPersona(
  ctx: WatchlistScannerPersonaContext,
  input: {
    symbol: string;
    spotPrice: number;
    priorRationale?: string;
    lineType?: string;
    strategy?: string;
  }
): Promise<string | null> {
  const user = JSON.stringify({
    symbol: input.symbol,
    spotPrice: input.spotPrice,
    priorRationale: input.priorRationale?.trim() ?? "",
    lineType: input.lineType?.trim() ?? "",
    strategy: input.strategy?.trim() ?? ""
  });
  try {
    let text: string;
    if (ctx.tools.length > 0) {
      const loop = await respondWithXaiToolLoop({
        model: ctx.model,
        systemPrompt: ctx.systemPrompt,
        userPrompt: user,
        tools: ctx.tools,
        toolChoice: ctx.toolChoice,
        maxTurns: ctx.maxTurns,
        responsesReasoning: ctx.responsesReasoning,
        executor: createOptionsScannerToolExecutor()
      });
      text = loop.outputText.trim();
    } else {
      const single = await respondWithXai({
        model: ctx.model,
        systemPrompt: ctx.systemPrompt,
        userPrompt: user,
        maxTurns: Math.min(Math.max(ctx.maxTurns, 1), 8),
        responsesReasoning: ctx.responsesReasoning
      });
      text = single.outputText.trim();
    }
    return parseWatchlistRowRationaleJson(text);
  } catch {
    return null;
  }
}

export function watchlistScannerGrokEnv(): { grokEnabled: boolean; maxGrokCalls: number } {
  const grok =
    process.env.WATCHLIST_SCANNER_GROK_ENABLED === undefined ||
    process.env.WATCHLIST_SCANNER_GROK_ENABLED === "true" ||
    process.env.WATCHLIST_SCANNER_GROK_ENABLED === "1";
  const maxGrok = Number.parseInt(process.env.WATCHLIST_SCANNER_GROK_MAX_CALLS ?? "40", 10);
  return {
    grokEnabled: grok,
    maxGrokCalls: Number.isFinite(maxGrok) && maxGrok >= 0 ? maxGrok : 40
  };
}
