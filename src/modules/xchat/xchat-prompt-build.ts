/**
 * Single place for xChat **system** prompt assembly (ask + batch) and session tool copy.
 * Execution paths stay separate: ask uses `respondWithXaiToolLoop`; batch uses xAI Batch JSONL.
 */

const HOSTED_SEARCH_TOOL_COPY = `Hosted search (web_search / x_search):
Invoke these only through the API’s native tool mechanism. Do not print pseudo calls in assistant text—no \`<xai-tool>\`, \`<function_call>\`, fenced JSON tool blobs, or \`{"name":"web_search",...}\` payloads (users must never see markup). After the platform runs search, summarize results in plain language.`;

const XCHAT_BETA_CLIENT_UI_INSTRUCTIONS = `Client UI (beta): The xChat composer shows attach (paperclip), an Auto model shortcut, dictation (microphone), and voice mode (waveform). These controls are not wired to the backend yet—only typed text and Send submit a turn. If the user asks about attachments, speech-to-text, hotkeys, or live voice, say they are in beta and coming soon; do not imply those features work today.`;

const XCHAT_CITATION_MARKDOWN_CONTRACT = `Citation chips (xChat UI): When a sentence is grounded on live market data or tools, add a chip using bracket syntax: [@citation:market_quote], [@citation:yahoo_finance], [@citation:file_search], [@citation:web_search], [@citation:x_search], [@citation:code_interpreter], or [@citation:atxfinance] for workspace/portfolio tools (xAI tool name is atx_function; citation slug stays atxfinance for the same chip). Optional alias [@citation:atx_function] maps to atxfinance. Equivalent tool-style token: [@tool:slug] (same chip). Optional label: [@citation:market_quote|Yahoo Finance]. Slugs are lowercase with underscores. Do not emit <grok:render>, <function_calls>, or other pseudo-execution XML—the client strips or maps those; prefer bracket citations in prose. For a standalone line, use a fenced block with language xf-citation and JSON: {"slug":"atxfinance","label":"Optional"}.`;

const XCHAT_NO_CITATIONS_INSTRUCTION = `Output style: Do not use xChat citation chips. Do not write bracket tokens like [@citation:…] or [@tool:…], xf-citation fenced blocks, or <grok:render> citation markup. Answer in plain prose without source chips.`;

const ATX_FUNCTION_TOOL_COPY = `Workspace tools (this signed-in user only):
**Live portfolio, watchlist, and balances are not pre-loaded into the system prompt.** Use **atx_function** when you need workspace facts: **portfolio_summary** (overview, per-account cashBalance, position counts, watchlist on the default portfolio), **positions_snapshot** (symbol, qty, avgCost per account; may truncate), **watchlist_snapshot** (watchlist-only), **account_health** (balances + default account). Prefer the smallest call that answers the question; avoid redundant tool calls after you already have current data for this turn.
When a **workspace snapshot** block is present, watchlist symbols include **addedAtDisplay**; **targetEntryNotional100xDisplay** (same as the Watchlist page **Target entry** column—whole-dollar **100×** Yahoo quote); **targetEntryDisplay** / **entryPrice** / **targetEntryPrice** (stored **desk entry price** in USD, separate from the column). When listing to match the Watchlist **table**, lead with **targetEntryNotional100xDisplay** (use "—" when missing); mention desk **targetEntryDisplay** only when the user cares about saved entry price.
When presenting a watchlist from **tool output** only, use the same fields: **target entry** in the UI sense = **targetEntryNotional100xDisplay**; desk/stored price = **targetEntryDisplay** or \`entryPrice\` / \`targetEntryPrice\`.
If the user asks to "show my watchlist" (or equivalent), enumerate **every symbol returned** in the tool result (do not sample or truncate short lists).
When the user asks to add or remove watchlist symbols (e.g. "add NVDA to my watchlist", "remove AAPL"), call watchlist_add_symbols or watchlist_remove_symbols with symbol or symbols—then confirm the updated list briefly. Adds upsert new rows with default line type Stock and strategy balanced, and set watchlist desk to growth risk and balanced outlook only when those fields were unset.
Use real atx_function function calls via the API. Prefer native API tool calls only—do not print \`<function_call>\`, \`<xai-tool>\`, or fenced JSON tool stubs in assistant text (users must never see pseudo markup; one native call can follow another if needed).
For **live quotes** use yahoo_finance or atx_function with operation **market_quote**. For **task_status**, call atx_function.
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

export type BuildXchatSystemPromptInput = {
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
 * Locked order: **persona → RAG → recent history → snapshot → session tool instructions → citation policy → beta client UI note** (double-newline separated).
 */
export function buildXchatSystemPrompt(input: BuildXchatSystemPromptInput): string {
  const citationsEnabled = input.citationsEnabled !== false;
  const base =
    typeof input.personaSystem === "string" && input.personaSystem.trim().length > 0
      ? input.personaSystem.trim()
      : input.fallbackPersonaSystem.trim();
  const rag =
    typeof input.ragContext === "string" && input.ragContext.trim().length > 0
      ? `Use the following RAG context if relevant:\n${input.ragContext.trim()}`
      : "No RAG context available.";
  const parts: string[] = [base, rag];
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
