import { ObjectId } from "mongodb";

import { respondWithXai } from "@/lib/xai";
import {
    searchFinanceKbCollectionForXchatPreRag,
    type FinanceKbRagSurface
} from "@/modules/xchat/finance-kb-rag-search";
import { getYahooMarketQuote, type MarketQuoteSnapshot } from "@/modules/xchat/market-data";
import { resolveXchatPersonaDeclaredCollectionIds } from "@/modules/xchat/persona-linked-collections";
import { getScopeReadinessSummary } from "@/modules/xchat/rag-file-readiness";
import { retrieveRagChunks } from "@/modules/xchat/repository";
import {
    isAtxFunctionToolType,
    normalizePersonaXapiConfig,
    type PersonaConfig,
    type PersonaXapiConfig,
    type RagChunk
} from "@/modules/xchat/types";
import { buildWorkspaceServerSnapshotBlock } from "@/modules/xchat/workspace-snapshot-for-prompt";

const DEFAULT_SYNTHESIS_MODEL = "grok-4-1-fast-reasoning";

const DEFAULT_TOP_K = 4;
const DEFAULT_MAX_YAHOO_PARALLEL = 6;

import { extractTickerCandidates } from "@/modules/xchat/ticker-candidates";

export { extractTickerCandidates } from "@/modules/xchat/ticker-candidates";

export type MultiSourceGatherError = {
  source: "workspace_snapshot" | "xai_collection_rag" | "mongo_scope_rag" | "yahoo_quote";
  message: string;
  detail?: string;
};

export type MultiSourceGatherResult = {
  workspaceSnapshotBlock: string | null;
  xaiCollectionSnippets: Array<{ text: string; documentName?: string; documentId?: string }>;
  mongoRagChunks: RagChunk[];
  quotesBySymbol: Record<string, MarketQuoteSnapshot>;
  errors: MultiSourceGatherError[];
  meta: {
    linkedCollectionIds: string[];
    xaiCollectionSearchRan: boolean;
    mongoRagRan: boolean;
    yahooSymbolsRequested: string[];
    collectionSearchSkippedReason?: "no_collections" | "blocked_non_ready_files" | "rag_disabled";
  };
};

export type MultiSourceOrchestratorInput = {
  userId: string;
  tenantId: string;
  message: string;
  persona: PersonaConfig | null | undefined;
  scope?: string;
  topK?: number;
  maxParallelYahoo?: number;
  /** Finance KB pre-search guideline filter (`atx-response-guidelines` AIP-160 `surface`). */
  financeKbRagSurface?: FinanceKbRagSurface;
};

function personaAllowsAtxfinance(xapi: PersonaXapiConfig): boolean {
  return xapi.tools.some((t) => isAtxFunctionToolType(t.type));
}

function personaAllowsYahooBatch(xapi: PersonaXapiConfig): boolean {
  return xapi.tools.some((t) => t.type === "yahoo_finance" || isAtxFunctionToolType(t.type));
}

function pushError(
  errors: MultiSourceGatherError[],
  source: MultiSourceGatherError["source"],
  err: unknown
): void {
  errors.push({
    source,
    message: err instanceof Error ? err.message : String(err)
  });
}

/**
 * Parallel **data** gather for xChat-style context: workspace snapshot (if persona includes `atxfinance`),
 * persona-linked xAI collection search, Mongo scope RAG, and Yahoo quotes for tickers in the user message
 * (if persona allows `yahoo_finance` or `atxfinance`). No LLM calls.
 *
 * Allowlists: all branches respect **resolved persona** `xapi.tools` and `enableRag` / **team KB** collection
 * ids only (same policy as `POST /api/xchat/ask`: `resolveXchatPersonaDeclaredCollectionIds`).
 */
export async function gatherMultiSourceWorkspaceContext(
  input: MultiSourceOrchestratorInput
): Promise<MultiSourceGatherResult> {
  const topK = input.topK ?? DEFAULT_TOP_K;
  const maxYahoo = input.maxParallelYahoo ?? DEFAULT_MAX_YAHOO_PARALLEL;
  const persona = input.persona ?? null;
  const xapi = normalizePersonaXapiConfig(persona?.xapi);
  const linkedCollectionIds = resolveXchatPersonaDeclaredCollectionIds(persona ?? undefined);
  const scope = (input.scope ?? persona?.defaultScope ?? "global").trim() || "global";
  const tenantOid = ObjectId.isValid(input.tenantId) ? new ObjectId(input.tenantId) : null;

  const errors: MultiSourceGatherError[] = [];
  const ragEnabled = persona?.enableRag !== false;

  let collectionSearchSkippedReason: MultiSourceGatherResult["meta"]["collectionSearchSkippedReason"];
  let xaiSearchAllowed = false;
  if (!ragEnabled) {
    collectionSearchSkippedReason = "rag_disabled";
  } else if (linkedCollectionIds.length === 0) {
    collectionSearchSkippedReason = "no_collections";
  } else {
    const readiness = await getScopeReadinessSummary({
      scope,
      tenantId: tenantOid ?? undefined,
      linkedCollectionIds
    });
    if (readiness.blocked) {
      collectionSearchSkippedReason = "blocked_non_ready_files";
    } else {
      xaiSearchAllowed = true;
    }
  }

  const allowSnapshot = personaAllowsAtxfinance(xapi);
  const allowYahoo = personaAllowsYahooBatch(xapi);
  const yahooSymbols = allowYahoo ? extractTickerCandidates(input.message, maxYahoo) : [];

  const snapshotP = allowSnapshot
    ? buildWorkspaceServerSnapshotBlock({
        userId: input.userId,
        tenantId: input.tenantId
      }).catch((e) => {
        pushError(errors, "workspace_snapshot", e);
        return null as string | null;
      })
    : Promise.resolve(null);

  const financeKbSurface = input.financeKbRagSurface ?? "xchat";
  const xaiRagP =
    ragEnabled && xaiSearchAllowed && linkedCollectionIds.length > 0
      ? searchFinanceKbCollectionForXchatPreRag({
          query: input.message,
          limit: topK,
          userMessage: input.message,
          workspaceSummary: null,
          surface: financeKbSurface
        }).catch((e) => {
          pushError(errors, "xai_collection_rag", e);
          return [] as Array<{ text: string; documentName?: string; documentId?: string }>;
        })
      : Promise.resolve([]);

  const mongoRagP = ragEnabled
    ? retrieveRagChunks(tenantOid, scope, input.message, topK).catch((e) => {
        pushError(errors, "mongo_scope_rag", e);
        return [] as RagChunk[];
      })
    : Promise.resolve([]);

  const yahooP =
    yahooSymbols.length > 0
      ? Promise.allSettled(
          yahooSymbols.map(async (symbol) => {
            const q = await getYahooMarketQuote({ symbol });
            return { symbol: q.symbol, q };
          })
        ).then((settled) => {
          const out: Record<string, MarketQuoteSnapshot> = {};
          for (let i = 0; i < settled.length; i++) {
            const s = yahooSymbols[i];
            const r = settled[i];
            if (r.status === "fulfilled") {
              out[r.value.symbol] = r.value.q;
            } else {
              pushError(errors, "yahoo_quote", r.reason);
              if (s) {
                errors[errors.length - 1]!.detail = s;
              }
            }
          }
          return out;
        })
      : Promise.resolve({} as Record<string, MarketQuoteSnapshot>);

  const [workspaceSnapshotBlock, xaiCollectionSnippets, mongoRagChunks, quotesBySymbol] =
    await Promise.all([snapshotP, xaiRagP, mongoRagP, yahooP]);

  return {
    workspaceSnapshotBlock,
    xaiCollectionSnippets,
    mongoRagChunks,
    quotesBySymbol,
    errors,
    meta: {
      linkedCollectionIds,
      xaiCollectionSearchRan: ragEnabled && xaiSearchAllowed && linkedCollectionIds.length > 0,
      mongoRagRan: ragEnabled,
      yahooSymbolsRequested: yahooSymbols,
      collectionSearchSkippedReason
    }
  };
}

/**
 * Formats gathered blocks for a single downstream model call (no tools).
 */
export function formatGatheredContextForPrompt(gathered: MultiSourceGatherResult): string {
  const sections: string[] = [];

  if (gathered.workspaceSnapshotBlock) {
    sections.push("## Workspace (server-loaded)\n\n" + gathered.workspaceSnapshotBlock);
  }

  if (gathered.xaiCollectionSnippets.length > 0) {
    const lines = gathered.xaiCollectionSnippets.map((s, i) => {
      const src = s.documentName ?? s.documentId ?? "collection_doc";
      return `[#${i + 1}] (${src}) ${s.text}`;
    });
    sections.push("## Persona-linked xAI collection snippets\n\n" + lines.join("\n\n"));
  }

  if (gathered.mongoRagChunks.length > 0) {
    const lines = gathered.mongoRagChunks.map((c, i) => `[#${i + 1}] ${c.text}`);
    sections.push("## Mongo scope RAG chunks\n\n" + lines.join("\n\n"));
  }

  const quoteKeys = Object.keys(gathered.quotesBySymbol);
  if (quoteKeys.length > 0) {
    sections.push(
      "## Yahoo Finance quotes (delayed; not exchange-grade)\n\n```json\n" +
        JSON.stringify(gathered.quotesBySymbol, null, 2) +
        "\n```"
    );
  }

  if (gathered.errors.length > 0) {
    sections.push(
      "## Partial failures (some sources omitted)\n\n" +
        gathered.errors.map((e) => `- ${e.source}: ${e.message}`).join("\n")
    );
  }

  if (sections.length === 0) {
    return "(No pre-gathered context: persona tools/RAG settings did not enable any branch, or all sources failed.)";
  }

  return sections.join("\n\n---\n\n");
}

const DEFAULT_SYNTHESIS_INSTRUCTIONS =
  "You are answering using only the pre-loaded context sections above plus the user message. " +
  "If a section is missing or empty, say so. Prefer concise, actionable options commentary; " +
  "reference which section you used. This is not financial advice.";

export type MultiSourceSynthesisInput = {
  persona: PersonaConfig;
  userMessage: string;
  gathered: MultiSourceGatherResult;
  /** Appended after persona system prompt. */
  synthesisSystemInstructions?: string;
  maxTurns?: number;
};

/**
 * One **xAI Responses** call with **no tools** — synthesis only over `gathered` + user text.
 */
export async function synthesizeFromMultiSourceContext(
  input: MultiSourceSynthesisInput
): Promise<{ outputText: string; model: string; raw: unknown }> {
  const model =
    typeof input.persona.model === "string" && input.persona.model.trim().length > 0
      ? input.persona.model.trim()
      : DEFAULT_SYNTHESIS_MODEL;

  const baseSystem = input.persona.systemPrompt?.trim() || "You are a helpful finance workspace assistant.";
  const extra = input.synthesisSystemInstructions?.trim() || DEFAULT_SYNTHESIS_INSTRUCTIONS;
  const systemPrompt = [baseSystem, extra].join("\n\n");

  const bundle = formatGatheredContextForPrompt(input.gathered);
  const userPrompt = [
    bundle,
    "",
    "---",
    "",
    "User message:",
    input.userMessage.trim()
  ].join("\n");

  const result = await respondWithXai({
    model,
    systemPrompt,
    userPrompt,
    tools: [],
    toolChoice: "none",
    maxTurns: input.maxTurns ?? 4
  });

  return {
    outputText: result.outputText,
    model: result.model,
    raw: result.raw
  };
}

/**
 * Internal one-shot: **parallel gather** + **single** synthesis call. Wire to HTTP/scheduler later.
 */
export async function runMultiSourceWorkspaceSynthesis(
  input: MultiSourceOrchestratorInput & { persona: PersonaConfig }
): Promise<{
  outputText: string;
  model: string;
  raw: unknown;
  gathered: MultiSourceGatherResult;
}> {
  const gathered = await gatherMultiSourceWorkspaceContext(input);
  const { outputText, model, raw } = await synthesizeFromMultiSourceContext({
    persona: input.persona,
    userMessage: input.message,
    gathered
  });
  return { outputText, model, raw, gathered };
}
