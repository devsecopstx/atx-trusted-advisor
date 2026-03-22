import { ObjectId } from "mongodb";

import { respondWithXai, searchDocumentsInCollections } from "@/lib/xai";
import { getYahooMarketQuote, type MarketQuoteSnapshot } from "@/modules/xchat/market-data";
import { getPersonaLinkedCollectionIds } from "@/modules/xchat/persona-linked-collections";
import { getScopeReadinessSummary } from "@/modules/xchat/rag-file-readiness";
import { retrieveRagChunks } from "@/modules/xchat/repository";
import {
    normalizePersonaXapiConfig,
    type PersonaConfig,
    type PersonaXapiConfig,
    type RagChunk
} from "@/modules/xchat/types";
import { buildWorkspaceServerSnapshotBlock } from "@/modules/xchat/workspace-snapshot-for-prompt";

const DEFAULT_SYNTHESIS_MODEL = "grok-4-1-fast-reasoning";

const DEFAULT_TOP_K = 4;
const DEFAULT_MAX_YAHOO_PARALLEL = 6;

/** Uppercase tokens that look like tickers but are common English words. */
const TICKER_STOPWORDS = new Set([
  "THE",
  "AND",
  "FOR",
  "ARE",
  "BUT",
  "NOT",
  "YOU",
  "ALL",
  "CAN",
  "HER",
  "WAS",
  "ONE",
  "OUR",
  "OUT",
  "DAY",
  "GET",
  "HAS",
  "HIM",
  "HIS",
  "HOW",
  "ITS",
  "MAY",
  "NEW",
  "NOW",
  "OLD",
  "SEE",
  "TWO",
  "WAY",
  "WHO",
  "BOY",
  "DID",
  "LET",
  "PUT",
  "SAY",
  "SHE",
  "TOO",
  "USE",
  "ANY",
  "BAD",
  "BIG",
  "FEW",
  "GOT",
  "HAD",
  "HOT",
  "OWN",
  "RAN",
  "SIT",
  "TRY",
  "YES",
  "YET",
  "ALSO",
  "BACK",
  "CALL",
  "CAME",
  "COME",
  "EVEN",
  "FACE",
  "FACT",
  "FELL",
  "FELT",
  "FIND",
  "FIVE",
  "FOUR",
  "FROM",
  "GAVE",
  "GIVE",
  "GOOD",
  "HALF",
  "HAND",
  "HAVE",
  "HEAR",
  "HERE",
  "HIGH",
  "HOLD",
  "HOME",
  "INTO",
  "JUST",
  "KEEP",
  "KIND",
  "KNEW",
  "KNOW",
  "LAND",
  "LAST",
  "LEFT",
  "LIFE",
  "LINE",
  "LIVE",
  "LONG",
  "LOOK",
  "MADE",
  "MAKE",
  "MANY",
  "MEAN",
  "MORE",
  "MOST",
  "MOVE",
  "MUCH",
  "MUST",
  "NAME",
  "NEAR",
  "NEED",
  "NEXT",
  "NINE",
  "ONCE",
  "ONLY",
  "OPEN",
  "OVER",
  "PART",
  "PICK",
  "PLAN",
  "PLAY",
  "PULL",
  "READ",
  "REAL",
  "REST",
  "RUNS",
  "SAFE",
  "SAID",
  "SAME",
  "SEEM",
  "SHOW",
  "SIDE",
  "SOME",
  "SONG",
  "SOON",
  "STAR",
  "STOP",
  "SUCH",
  "SURE",
  "TAKE",
  "TALK",
  "TELL",
  "TEN",
  "THAN",
  "THEM",
  "THEN",
  "THEY",
  "THIS",
  "TIME",
  "TOLD",
  "TOOK",
  "TURN",
  "VERY",
  "WAIT",
  "WALK",
  "WANT",
  "WELL",
  "WENT",
  "WERE",
  "WHAT",
  "WHEN",
  "WHOM",
  "WILL",
  "WITH",
  "WORD",
  "WORK",
  "YEAR",
  "YOUR",
  "ZERO",
  "AREA",
  "CASE",
  "COST",
  "DATA",
  "DOWN",
  "EACH",
  "ELSE",
  "ENDS",
  "FORM",
  "FULL",
  "HELP",
  "HOUR",
  "IDEA",
  "LESS",
  "LOSE",
  "LOSS",
  "MIND",
  "MISS",
  "OPEN",
  "PAST",
  "RATE",
  "RISK",
  "RULE",
  "SALE",
  "SELL",
  "SHIP",
  "TEAM",
  "THAT",
  "TILL",
  "TIPS",
  "TOLD",
  "TRIM",
  "TRUE",
  "TURN",
  "UPON",
  "VIA",
  "WEEK",
  "WINS",
  "WITH",
  "BUY",
  "SELL",
  "LONG",
  "SHORT",
  "CALL",
  "PUTS",
  "PUT",
  "MAYBE",
  "TODAY",
  "LIKE",
  "JUST",
  "OVER",
  "UNDER",
  "NEAR",
  "EACH",
  "EVEN"
]);

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
};

function personaAllowsAtxfinance(xapi: PersonaXapiConfig): boolean {
  return xapi.tools.some((t) => t.type === "atxfinance");
}

function personaAllowsYahooBatch(xapi: PersonaXapiConfig): boolean {
  return xapi.tools.some((t) => t.type === "yahoo_finance" || t.type === "atxfinance");
}

/**
 * Extract likely equity tickers from free text (uppercase alphanumerics + dot).
 * Conservative: filters common English stopwords; cap with `max`.
 */
export function extractTickerCandidates(message: string, max: number): string[] {
  const upper = message.toUpperCase();
  const re = /\b[A-Z][A-Z0-9.]{0,9}\b/g;
  const found: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper)) !== null) {
    const w = m[0];
    if (w.length < 1 || w.length > 10) {
      continue;
    }
    if (TICKER_STOPWORDS.has(w)) {
      continue;
    }
    if (seen.has(w)) {
      continue;
    }
    seen.add(w);
    found.push(w);
    if (found.length >= max) {
      break;
    }
  }
  return found;
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
 * Allowlists: all branches respect **resolved persona** `xapi.tools` and `enableRag` / linked collection ids
 * (same policy as `POST /api/xchat/ask`).
 */
export async function gatherMultiSourceWorkspaceContext(
  input: MultiSourceOrchestratorInput
): Promise<MultiSourceGatherResult> {
  const topK = input.topK ?? DEFAULT_TOP_K;
  const maxYahoo = input.maxParallelYahoo ?? DEFAULT_MAX_YAHOO_PARALLEL;
  const persona = input.persona ?? null;
  const xapi = normalizePersonaXapiConfig(persona?.xapi);
  const linkedCollectionIds = getPersonaLinkedCollectionIds(persona ?? undefined);
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
      tenantId: tenantOid ?? undefined
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

  const xaiRagP =
    ragEnabled && xaiSearchAllowed && linkedCollectionIds.length > 0
      ? searchDocumentsInCollections({
          query: input.message,
          collectionIds: linkedCollectionIds,
          limit: topK
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
