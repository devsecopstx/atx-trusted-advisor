/**
 * Single place for xChat **system** prompt assembly (ask + batch) and session tool copy.
 * Execution paths stay separate: ask uses `respondWithXaiToolLoop`; batch uses xAI Batch JSONL.
 */

import { createHash } from "node:crypto";

const HOSTED_SEARCH_TOOL_COPY = `Hosted search (web_search / x_search):
Invoke these only through the API’s native tool mechanism. Do not print pseudo calls in assistant text—no \`<xai-tool>\`, \`<function_call>\`, fenced JSON tool blobs, or \`{"name":"web_search",...}\` payloads (users must never see markup). After the platform runs search, summarize results in plain language.`;

const XCHAT_BETA_CLIENT_UI_INSTRUCTIONS = `Client UI (beta): Users send typed prompts (Enter; Shift+Enter newline). Vision accepts pasted screenshots in supporting browsers. Dictation (mic) uses server-side xAI STT only (MediaRecorder → transcribe API); transcripts land in the composer for review before Send. Voice Mode (waveform) opens a separate realtime xAI speech session with an optional server-injected workspace snapshot in instructions (not the same persistence as typed xChat / persona Mongo logs unless product wires transcript export). Premium+ tenants (and global_admin testing) can upload files to the tenant xAI collection via the composer paperclip or the Resources rail; embeddings/indexing may lag briefly—say uploads route into tenant RAG when linked, not instant omniscience. Voice Agent tools may still differ from typed xChat persona tools until parity ships—say so briefly if asked.`;

const XCHAT_CITATION_MARKDOWN_CONTRACT = `Citation chips (xChat UI): When a sentence is grounded on live market data or tools, add a chip using bracket syntax: [@citation:market_quote], [@citation:yahoo_finance], [@citation:file_search], [@citation:web_search], [@citation:x_search], [@citation:code_interpreter], or [@citation:atxfinance] for workspace/portfolio tools (xAI tool name is atx_function; citation slug stays atxfinance for the same chip). Optional alias [@citation:atx_function] maps to atxfinance. Equivalent tool-style token: [@tool:slug] (same chip). Optional label: [@citation:market_quote|Yahoo Finance]. Slugs are lowercase with underscores. Do not emit <grok:render>, <function_calls>, or other pseudo-execution XML—the client strips or maps those; prefer bracket citations in prose. For a standalone line, use a fenced block with language xf-citation and JSON: {"slug":"atxfinance","label":"Optional"}.`;

const XCHAT_NO_CITATIONS_INSTRUCTION = `Output style: Do not use xChat citation chips. Do not write bracket tokens like [@citation:…] or [@tool:…], xf-citation fenced blocks, or <grok:render> citation markup. Answer in plain prose without source chips.`;

const ATX_FUNCTION_TOOL_COPY = `Workspace tools (this signed-in user only):
**Live portfolio, watchlist, and balances are not pre-loaded into the system prompt.** Use **atx_function** when you need workspace facts: **portfolio_summary** (overview, per-account cashBalance, position counts, watchlist on the default portfolio), **positions_snapshot** (symbol, qty, avgCost per account; may truncate), **watchlist_snapshot** (watchlist-only), **account_health** (balances + default account). Prefer the smallest call that answers the question; avoid redundant tool calls after you already have current data for this turn.
When a **workspace snapshot** block is present, watchlist symbols include **spotPriceDisplay** (Yahoo last, USD); **targetEntryNotional100xUsdDisplay** and **targetEntryNotional100xDisplay** (100× Yahoo quote—Watchlist **Target entry** column; USD string vs plain number string); **addedAtDisplay** (omit when the user only wants prices); **targetEntryDisplay** / **entryPrice** / **targetEntryPrice** (stored **desk entry price** in USD). When listing like the Watchlist **table**, lead with spot + **targetEntryNotional100xUsdDisplay** (or notional display); mention desk **targetEntryDisplay** only when the user cares about saved entry price.
When presenting a watchlist from **tool output** only, prefer **spotPriceDisplay** and **targetEntryNotional100xUsdDisplay** in USD; desk/stored price = **targetEntryDisplay** or \`entryPrice\` / \`targetEntryPrice\`.
If the user asks to "show my watchlist" (or equivalent), enumerate **every symbol returned** in the tool result (do not sample or truncate short lists).
When the user asks to add or remove watchlist symbols (e.g. "add NVDA to my watchlist", "remove AAPL"), call watchlist_add_symbols or watchlist_remove_symbols with symbol or symbols—then confirm the updated list briefly. Adds upsert new rows with default line type Stock and strategy balanced, and set watchlist desk to growth risk and balanced outlook only when those fields were unset.
Use real atx_function function calls via the API. Prefer native API tool calls only—do not print \`<function_call>\`, \`<xai-tool>\`, or fenced JSON tool stubs in assistant text (users must never see pseudo markup; one native call can follow another if needed).
For **live quotes** use yahoo_finance or atx_function with operation **market_quote**. For **task_status**, call atx_function.
When you run **options_scan** for CSP/put-idea requests, format with an HNWI desk style:
- Start with a 1-2 line **market context** (symbol/spot/change + filter recap).
- Then output one compact markdown table with this exact column set:
  \`Strike | Premium | IV | OI | Delta | Breakeven | ROC (ann.) | Cash Req | Assignment Risk | Desk Note\`
- Show **max 5 rows total** in the table.
- Always include a **Top 3 ranked ideas** section using tags (e.g. Best Yield, Best Liquidity, Best Risk/Reward).
- Keep commentary concise (no long educational blocks); preserve existing disclaimer language.
- If chain data is sparse, unavailable, or fails filters, degrade gracefully: explain the gap, show any viable rows, and suggest one relaxed retry (DTE/IV/OI) without fabricating values.
For CSP table math (when fields are present): \`Breakeven = strike - premium(mid)\`; \`Cash Req = strike * 100\`; \`ROC (ann.) = (premium/strike) * (365/DTE)\`.
When you run **options_scan** for covered-call idea requests, format with an HNWI desk style:
- Start with a 1-2 line **market context** (symbol/spot/change + filter recap).
- Then output one compact markdown table with this exact column set:
  \`Strike | Premium | IV | OI | Delta | Upside to Strike | ROC (ann.) | Notional (100sh) | Call-Away Risk | Desk Note\`
- Show **max 5 rows total** in the table.
- Always include a **Top 3 ranked ideas** section using tags (e.g. Best Yield, Best Liquidity, Best Upside/Income Balance).
- Keep commentary concise (no long educational blocks); preserve existing disclaimer language.
- If chain data is sparse, unavailable, or fails filters, degrade gracefully: explain the gap, show any viable rows, and suggest one relaxed retry (DTE/IV/OI) without fabricating values.
For covered-call table math (when fields are present): \`Upside to Strike = ((strike - spot) / spot) * 100\`; \`Notional (100sh) = strike * 100\`; \`ROC (ann.) = (premium/spot) * (365/DTE)\`.
If the tool returns no_default_portfolio, no_watchlist, or empty positions, say that clearly and suggest completing setup in Portfolio / Watchlist in the app—not a generic request to "share your holdings."

**NL (natural language) before structured options / strategy flows:** When the user asks for an xOptions-style or multi-leg strategy setup, use **nl**—short, direct questions—to collect any **required** inputs (underlying, direction, timeframe, risk cap, position context) before you infer strikes or recommend actions. If something essential is missing, ask in nl; do not guess symbols or sizing. Workspace data for *their* book should come from **atx_function** (and yahoo_finance for quotes)—not by re-prompting the user to paste holdings. For the **full slot + artifact orchestrator** (auditable Markdown + JSON after desk slots), direct them to **xOptions → Hardcore strategy jobs** (\`/xoptions\`, guided \`/api/strategy-jobs\` via BFF). The server may also surface a one-turn preflight in chat when intent clearly matches that flow.`;

export const XCHAT_SERVER_ROUTING_POLICY_BLOCK = `**Server routing policy (TEAM KB + tools):** Snippets from team xAI collections are injected above when available—prefer them first for policy, playbooks, and static docs. **Live portfolio** state: **atx_function** on demand (not bulk-injected each turn). **Quotes:** yahoo_finance or atx_function \`market_quote\`—never invent prices from web prose. **Breaking news / sentiment:** web_search / x_search after KB when freshness matters. **Heavy multi-source synthesis** uses parallel multi-agent only when the user explicitly raises effort or the question clearly requires cross-source reconciliation—the default path is one model pass plus retrieval and selective tools.`;

export type SessionToolFlags = {
  /** Effective persona tools include `web_search` and/or `x_search` (after `mergeXchatHostedToolBaseline` on ask, this is usually true). */
  hostedSearch: boolean;
  /** Effective persona tools include `atx_function`. */
  atxFunction: boolean;
};

/**
 * One session-level instruction block derived from effective tools (hosted + custom).
 * Omit sections the persona does not expose.
 */
export function buildSessionToolInstructions(flags: SessionToolFlags): string {
  const parts: string[] = [];
  if (flags.hostedSearch) {
    parts.push(HOSTED_SEARCH_TOOL_COPY);
  }
  if (flags.atxFunction) {
    parts.push(ATX_FUNCTION_TOOL_COPY);
  }
  return parts.join("\n\n");
}

/**
 * Stable fingerprint for xAI **remote** thread chains (`previous_response_id`).
 * xAI does not allow resending `instructions` on continuation turns—the chain keeps the first
 * turn’s system prompt. When this fingerprint differs from the prior log’s, ask must start a
 * fresh chain so Mongo-edited persona + tool routing still apply.
 */
export type XchatRemoteChainFingerprintInput = {
  personaSystem: string;
  personaUpdatedAtMs: number;
  strategyJobOptOut: boolean;
  hostedSearch: boolean;
  atxFunction: boolean;
  citationsEnabled: boolean;
  /** Tenant workspace context block (trimmed); empty string when absent. */
  tenantWorkspaceContextBlock?: string;
};

export function computeXchatRemoteChainInstructionsFingerprint(
  input: XchatRemoteChainFingerprintInput
): string {
  const tenantCtx =
    typeof input.tenantWorkspaceContextBlock === "string"
      ? input.tenantWorkspaceContextBlock.trim()
      : "";
  const raw = [
    typeof input.personaSystem === "string" ? input.personaSystem : "",
    String(Number.isFinite(input.personaUpdatedAtMs) ? input.personaUpdatedAtMs : 0),
    input.strategyJobOptOut ? "1" : "0",
    input.hostedSearch ? "1" : "0",
    input.atxFunction ? "1" : "0",
    input.citationsEnabled ? "1" : "0",
    tenantCtx
  ].join("\0");
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}

export type BuildXchatSystemPromptInput = {
  /** Optional first block: tenant workspace display context (white-label; not regulatory claims). */
  tenantWorkspaceContextBlock?: string | null;
  /** Trimmed or raw persona `systemPrompt`; empty uses `fallbackPersonaSystem`. */
  personaSystem: string;
  fallbackPersonaSystem: string;
  /** Snippet text only (no wrapper); empty → “No RAG context available.” */
  ragContext: string;
  /** Prior turns from Mongo `xchat_logs` (same tenant); omitted when empty. */
  recentHistoryBlock?: string | null;
  workspaceSnapshot: string | null | undefined;
  sessionToolInstructions: string;
  /** Ask route: enforced retrieval/tools/multi-agent policy blurb. */
  routingPolicyBlock?: string | null;
  /**
   * Persona-driven: include citation-chip contract vs plain-prose-only instruction.
   * Default true when omitted.
   */
  citationsEnabled?: boolean;
};

/**
 * One-line tenant display context for xChat system prompts (ask + batch).
 * Does not change compliance posture — instructs the model not to invent regulatory claims.
 */
export function formatTenantWorkspaceContextBlockForXchat(input: {
  tenantName: string;
  xchatBrandName?: string | null;
}): string | null {
  const name = typeof input.tenantName === "string" ? input.tenantName.trim() : "";
  if (!name) {
    return null;
  }
  const brandRaw = typeof input.xchatBrandName === "string" ? input.xchatBrandName.trim() : "";
  const desk =
    brandRaw && brandRaw.toLowerCase() !== name.toLowerCase() ? `${brandRaw} (${name})` : name;
  return `Tenant workspace (display only): ${desk}. Address the user in a professional advisor tone when helpful (e.g., strategy session for this desk). Do not state or imply a different regulatory posture than the product standard disclosures.`;
}

/**
 * Locked order: **tenant display (optional) → persona → RAG → recent history → snapshot → session tool instructions → routing policy → citation policy → beta client UI note** (double-newline separated).
 */
export function buildXchatSystemPrompt(input: BuildXchatSystemPromptInput): string {
  const citationsEnabled = input.citationsEnabled !== false;
  const tenantCtx =
    typeof input.tenantWorkspaceContextBlock === "string"
      ? input.tenantWorkspaceContextBlock.trim()
      : "";
  const base =
    typeof input.personaSystem === "string" && input.personaSystem.trim().length > 0
      ? input.personaSystem.trim()
      : input.fallbackPersonaSystem.trim();
  const rag =
    typeof input.ragContext === "string" && input.ragContext.trim().length > 0
      ? `Use the following RAG context if relevant:\n${input.ragContext.trim()}`
      : "No RAG context available.";
  const parts: string[] = [];
  if (tenantCtx) {
    parts.push(tenantCtx);
  }
  parts.push(base, rag);
  const hist =
    typeof input.recentHistoryBlock === "string" && input.recentHistoryBlock.trim().length > 0
      ? input.recentHistoryBlock.trim()
      : "";
  if (hist) {
    parts.push(hist);
  }
  const snap =
    typeof input.workspaceSnapshot === "string" && input.workspaceSnapshot.trim().length > 0
      ? input.workspaceSnapshot.trim()
      : "";
  if (snap) {
    parts.push(snap);
  }
  const session = input.sessionToolInstructions.trim();
  if (session) {
    parts.push(session);
  }
  const routing = typeof input.routingPolicyBlock === "string" ? input.routingPolicyBlock.trim() : "";
  if (routing) {
    parts.push(routing);
  }
  parts.push(citationsEnabled ? XCHAT_CITATION_MARKDOWN_CONTRACT : XCHAT_NO_CITATIONS_INSTRUCTION);
  parts.push(XCHAT_BETA_CLIENT_UI_INSTRUCTIONS);
  return parts.join("\n\n");
}
