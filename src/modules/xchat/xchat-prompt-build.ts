/**
 * Single place for xChat **system** prompt assembly (ask + batch) and session tool copy.
 * Execution paths stay separate: ask uses `respondWithXaiToolLoop`; batch uses xAI Batch JSONL.
 */

const HOSTED_SEARCH_TOOL_COPY = `Hosted search (web_search / x_search):
Invoke these only through the API’s native tool mechanism. Do not print pseudo calls in assistant text—no \`<xai-tool>\`, \`<function_call>\`, fenced JSON tool blobs, or \`{"name":"web_search",...}\` payloads (users must never see markup). After the platform runs search, summarize results in plain language.`;

const XCHAT_BETA_CLIENT_UI_INSTRUCTIONS = `Client UI (beta): The xChat composer shows attach (paperclip), an Auto model shortcut, dictation (microphone), and voice mode (waveform). These controls are not wired to the backend yet—only typed text and Send submit a turn. If the user asks about attachments, speech-to-text, hotkeys, or live voice, say they are in beta and coming soon; do not imply those features work today.`;

const ATXFINANCE_TOOL_COPY = `Workspace tools (this signed-in user only):
When a "Workspace snapshot" JSON block appears in system context, it was loaded server-side for this turn—use it as authoritative for portfolio, accounts, watchlist, and the positions preview; call atxfinance for a full positions refresh, live market_quote, task_status, or if you suspect the snapshot is stale.
You MUST use the atxfinance tool when the user asks about their own portfolio, accounts, cash balances, watchlist tickers, or stock/option positions (holdings). Call it before answering—do not ask them to paste holdings or balances if a tool can retrieve them.
When the user asks to add or remove watchlist symbols (e.g. "add NVDA to my watchlist", "remove AAPL"), call watchlist_add_symbols or watchlist_remove_symbols with symbol or symbols—then confirm the updated list briefly.
Use real atxfinance function calls via the API. For open positions/holdings (symbol, qty, avg cost), set operation to positions_snapshot; for balances and account overview use portfolio_summary or account_health. Prefer native API tool calls only—do not print \`<function_call>\`, \`<xai-tool>\`, or fenced JSON tool stubs in assistant text (users must never see pseudo markup; one native call can follow another if needed).
Operations: portfolio_summary (overview, per-account cashBalance, position counts, **and watchlist** name/symbols on the default portfolio—summarize both when the user asks for a portfolio summary), positions_snapshot (symbol, qty, avgCost per account; may truncate), watchlist_snapshot (watchlist-only: symbols + addedAt), watchlist_add_symbols / watchlist_remove_symbols (pass symbol or symbols array), account_health (balances + default account). For live quotes use yahoo_finance or atxfinance with operation market_quote.
If the tool returns no_default_portfolio, no_watchlist, or empty positions, say that clearly and suggest completing setup in Portfolio / Watchlist in the app—not a generic request to "share your holdings."`;

export type SessionToolFlags = {
  /** Effective persona tools include `web_search` and/or `x_search` (after `mergeXchatHostedToolBaseline` on ask, this is usually true). */
  hostedSearch: boolean;
  /** Effective persona tools include `atxfinance`. */
  atxfinance: boolean;
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
  if (flags.atxfinance) {
    parts.push(ATXFINANCE_TOOL_COPY);
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
};

/**
 * Locked order: **persona → RAG → recent history → snapshot → session tool instructions → beta client UI note** (double-newline separated).
 */
export function buildXchatSystemPrompt(input: BuildXchatSystemPromptInput): string {
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
  parts.push(XCHAT_BETA_CLIENT_UI_INSTRUCTIONS);
  return parts.join("\n\n");
}
