/**
 * Single place for xChat **system** prompt assembly (ask + batch) and session tool copy.
 * Execution paths stay separate: ask uses `respondWithXaiToolLoop`; batch uses xAI Batch JSONL.
 */

import { createHash } from "node:crypto";

const HOSTED_SEARCH_TOOL_COPY = `Hosted search (web_search / x_search):
Invoke these only through the API’s native tool mechanism. Do not print pseudo calls in assistant text—no \`<xai-tool>\`, \`<function_call>\`, fenced JSON tool blobs, or \`{"name":"web_search",...}\` payloads (users must never see markup). After the platform runs search, summarize results in plain language.`;

const XCHAT_BETA_CLIENT_UI_INSTRUCTIONS = `Client UI (beta): Users send typed prompts (Enter; Shift+Enter newline). Vision accepts pasted screenshots in supporting browsers. Dictation (mic) uses server-side xAI STT only (MediaRecorder → transcribe API); transcripts land in the composer for review before Send. Voice Mode (waveform) opens a separate realtime xAI speech session with an optional server-injected workspace snapshot in instructions (not the same persistence as typed xChat / persona Mongo logs unless product wires transcript export). Premium+ tenants (and global_admin testing) can upload files to the tenant xAI collection via the composer paperclip or the Resources rail; embeddings/indexing may lag briefly—say uploads route into tenant RAG when linked, not instant omniscience. Voice Agent tools may still differ from typed xChat persona tools until parity ships—say so briefly if asked.`;

const XCHAT_CITATION_MARKDOWN_CONTRACT = `Citation chips (xChat UI): When a sentence is grounded on live market data or tools, add a chip using bracket syntax: [@citation:market_quote], [@citation:yahoo_finance], [@citation:file_search], [@citation:web_search], [@citation:x_search], [@citation:code_interpreter], or [@citation:atx_function] for workspace/portfolio tools (same slug as the xAI wire tool name atx_function). Legacy [@citation:atxfinance] maps to the same chip. Equivalent tool-style token: [@tool:slug] (same chip). Optional label: [@citation:market_quote|Yahoo Finance]. Slugs are lowercase with underscores. Do not emit bare XF_CITE:/XF_TOOL: lines, raw fenced blocks of only those sentinels, <grok:render>, <function_calls>, or other pseudo-execution XML—prefer [@citation:slug] inline in prose; standalone structured cite may use a fenced block with language xf-citation and JSON: {"slug":"atx_function","label":"Optional"}.`;

/** Extra discipline for automated daily/weekly portfolio monitors (email + in-app snippet). */
const XCHAT_SCHEDULED_DESK_REPORT_CITATION_BLOCK = `**Scheduled desk monitor / email report:** Totals, allocations, and positions already come from the **server workspace snapshot** (same data as **atx_function**). Do **not** glue citation markup to every dollar figure or table cell. Use **at most one** workspace citation for the entire report—either a single \`[@citation:atx_function]\` on its own **Sources** line after the body, or one short endnote sentence naming “workspace snapshot” without chips. For live Yahoo quotes outside the snapshot, use numbered footnotes [1], [2] per Finance KB citation format. Never place \`XF_CITE:\` / \`XF_TOOL:\` bare tokens, backticked chips, or \`[@citation:…]\` immediately after a number or inside table cells (bad: \`$165,684 [@citation:atx_function]\`).`;

const XCHAT_NO_CITATIONS_INSTRUCTION = `Output style: Do not use xChat citation chips. Do not write bracket tokens like [@citation:…] or [@tool:…], xf-citation fenced blocks, or <grok:render> citation markup. Answer in plain prose without source chips.`;

const ATX_FUNCTION_TOOL_COPY = `Workspace tools (this signed-in user only):
**Multi-portfolio names + a compact holdings/cash line per book** are injected server-side when \`atx_function\` is enabled (see **User workspace summary** in the system prompt). Use **user_workspace_summary** only if you need a fresh JSON refresh in the tool loop. For deeper rows, **portfolio_summary** (active/default portfolio overview + watchlist), **positions_snapshot** (symbol, qty, avgCost per account; may truncate), **watchlist_snapshot** (watchlist-only), **account_health** (balances + default account). Prefer the smallest call that answers the question; avoid redundant tool calls after you already have current data for this turn.
When a **workspace snapshot** block is present, watchlist symbols include **spotPriceDisplay** (Yahoo last, USD); **targetEntryNotional100xUsdDisplay** and **targetEntryNotional100xDisplay** (100× Yahoo quote—Watchlist **Target entry** column; USD string vs plain number string); **addedAtDisplay** (omit when the user only wants prices); **targetEntryDisplay** / **entryPrice** / **targetEntryPrice** (stored **desk entry price** in USD). When listing like the Watchlist **table**, lead with spot + **targetEntryNotional100xUsdDisplay** (or notional display); mention desk **targetEntryDisplay** only when the user cares about saved entry price.
When presenting a watchlist from **tool output** only, prefer **spotPriceDisplay** and **targetEntryNotional100xUsdDisplay** in USD; desk/stored price = **targetEntryDisplay** or \`entryPrice\` / \`targetEntryPrice\`.
If the user asks to "show my watchlist" (or equivalent), enumerate **every symbol returned** in the tool result (do not sample or truncate short lists).
When the user asks to add or remove watchlist symbols (e.g. "add NVDA to my watchlist", "remove AAPL"), call watchlist_add_symbols or watchlist_remove_symbols with symbol or symbols—then confirm the updated list briefly. Adds upsert new rows with default line type Stock and strategy balanced, and set watchlist desk to growth risk and balanced outlook only when those fields were unset.
**Premium+ NL price alerts (advisor desk):** For **show/list**, **add**, **remove/delete** per symbol, or **clear all**, use **atx_function** → **price_alert_manage** (\`list\` | \`add\` | \`remove_symbol\` | \`clear_all\`). **add** needs **symbol**, **targetPrice**, and **ruleKind** (\`above\` / \`below\` / \`crosses\`)—if the user only gave a ticker + number, **ask which direction** with short examples (do **not** assume crosses). Optional **portfolioHint** / **inPortfolio** resolves nickname/account → portfolio book; default = workspace portfolio. One active alert **per symbol per user** (any portfolio). **remove_symbol** / **clear_all** require explicit chat confirmation first, then **confirmDestructive: true**. Link **alertsDeepLink** from tool JSON (\`/portfolio/alerts\`). **plan_blocked_nl_price_alerts** = Premium+ + advisor/global_admin only—no invented pricing.
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

**Quant / Monte Carlo (quant-trader persona):** Server preflight injects **User workspace summary** (all portfolios) and often a full **Workspace snapshot** (active book: watchlist risk/outlook, \`investmentOutlook\`, \`bookTailRisk\`, positions preview). **Read those blocks before any tool call.** Then **monte_carlo_tail_risk** with \`risk\`, optional \`portfolioIds\` / \`portfolioScope: all\`, \`horizonDays\`, \`minIvRankPct\`, \`maxDrawdownPct\`. Pair with **strategy_recommendations** only after tail metrics when the user wants ranked structures. Do not re-fetch workspace via tools when preflight JSON already answers scope.

**NL (natural language) before structured options / strategy flows:** When the user asks for an xOptions-style or multi-leg strategy setup, use **nl**—short, direct questions—to collect any **required** inputs (underlying, direction, timeframe, risk cap, position context) before you infer strikes or recommend actions. If something essential is missing, ask in nl; do not guess symbols or sizing. Workspace data for *their* book should come from **atx_function** (and yahoo_finance for quotes)—not by re-prompting the user to paste holdings. For the **full slot + artifact orchestrator** (auditable Markdown + JSON after desk slots), direct them to **xOptions → Hardcore strategy jobs** (\`/xoptions\`, guided \`/api/strategy-jobs\` via BFF). The server may also surface a one-turn preflight in chat when intent clearly matches that flow.`;

/** Omits long HNWI-style **options_scan** desk table contracts; keeps workspace + NL discipline. */
const ATX_FUNCTION_TOOL_COPY_SLIM = `Workspace tools (this signed-in user only):
**Named portfolios + compact holdings** are pre-injected when enabled (User workspace summary). **user_workspace_summary** refreshes that JSON if needed; else **portfolio_summary**, **positions_snapshot**, **watchlist_snapshot**, **account_health**. Prefer the smallest call; avoid redundant tool calls after you have current data for this turn.
When a **workspace snapshot** block is present, watchlist symbols include **spotPriceDisplay** (Yahoo last, USD); **targetEntryNotional100xUsdDisplay** and desk **targetEntryDisplay** / **entryPrice**. When listing like the Watchlist **table**, lead with spot + target notional USD.
If the user asks to "show my watchlist" (or equivalent), enumerate **every symbol returned** in the tool result (do not sample or truncate short lists).
When the user asks to add or remove watchlist symbols, call watchlist_add_symbols or watchlist_remove_symbols—then confirm briefly.
**Premium+ NL price alerts (advisor desk):** Use **price_alert_manage** when the persona exposes it—same confirm/destructive rules as full routing.
Use real atx_function calls via the API—no pseudo \`<function_call>\` markup in user-visible text.
For **live quotes** use yahoo_finance or **market_quote**. For **task_status**, call atx_function.
When you run **options_scan**, summarize ranked contracts clearly from tool JSON; keep output compact unless the user asks for full desk-style tables. Avoid repeated options_scan calls on the same symbol/filters in one turn.
If the tool returns no_default_portfolio, no_watchlist, or empty positions, say that clearly.

**NL (natural language) before structured options / strategy flows:** When the user asks for an xOptions-style or multi-leg strategy setup, use **nl**—short, direct questions—to collect required inputs before inferring strikes. Workspace data should come from **atx_function** (and yahoo_finance for quotes). For the **Hardcore strategy jobs** orchestrator, direct them to **xOptions** (\`/xoptions\`).`;

export type XchatSessionToolCopyMode = "full" | "slim";

export function classifyXchatSessionToolCopyMode(message: string): XchatSessionToolCopyMode {
  const m = message.trim().toLowerCase();
  if (!m) {
    return "slim";
  }

  const educationalStub =
    /^\s*(what is|what's|define|explain)\s+(a\s+)?(covered call|cash[- ]secured put|iron condor|wheel)\b/i.test(m) ||
    /\b(teach me|basics of|introduction to)\s+(options|covered calls)\b/i.test(m);
  if (educationalStub && !/\b(my|our)\b.*\b(portfolio|holdings|positions|watchlist|stock)\b/i.test(m)) {
    return "slim";
  }

  const fullIntent =
    /\b(covered[- ]calls?|covered call\b|\bcsp\b|cash[- ]secured|iron condor|credit spread|put spread|call spread|calendar spread|diagonal|straddle|strangle)\b/.test(m) ||
    /\b(wheel strategy|\bthe wheel\b|wheel ideas|covered call ideas)\b/.test(m) ||
    /\b(options?\s*scan|scan my options)\b/.test(m) ||
    (/\b(from holdings|holdings)\b/.test(m) && /\b(watchlist|ideas?)\b/.test(m)) ||
    /\b(strike|strikes|expiry|expiration|\bdte\b|premium income|assignment|call-away)\b/.test(m) ||
    (/\b(watchlist|holdings|positions?|portfolio)\b/.test(m) &&
      /\b(option|call|put|wheel|income|premium)\b/.test(m)) ||
    /\b(price alert|portfolio\/alerts|strategy job|xoptions|multi[- ]leg|hardcore)\b/.test(m);

  return fullIntent ? "full" : "slim";
}

export const XCHAT_SERVER_ROUTING_POLICY_BLOCK = `**Server routing policy (tenant KB + tools):** Snippets from this workspace's linked xAI collections are injected above when available—prefer them first for policy, playbooks, and static docs. **Live portfolio** state: **atx_function** on demand (not bulk-injected each turn). **Quotes:** yahoo_finance or atx_function \`market_quote\`—never invent prices from web prose. **Breaking news / sentiment:** web_search / x_search after KB when freshness matters. **Heavy multi-source synthesis** uses parallel multi-agent only when the user explicitly raises effort or the question clearly requires cross-source reconciliation—the default path is one model pass plus retrieval and selective tools.`;

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
export function buildSessionToolInstructions(
  flags: SessionToolFlags,
  atxCopyMode: XchatSessionToolCopyMode = "full",
  options?: { quantTraderDesk?: boolean }
): string {
  const parts: string[] = [];
  if (flags.hostedSearch) {
    parts.push(HOSTED_SEARCH_TOOL_COPY);
  }
  if (flags.atxFunction) {
    const useFullCopy = options?.quantTraderDesk === true || atxCopyMode === "full";
    parts.push(useFullCopy ? ATX_FUNCTION_TOOL_COPY : ATX_FUNCTION_TOOL_COPY_SLIM);
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
  /** Persona `overridePrompt` (trimmed); empty when absent — edits must restart xAI remote chains. */
  personaOverridePrompt?: string;
  personaUpdatedAtMs: number;
  strategyJobOptOut: boolean;
  hostedSearch: boolean;
  atxFunction: boolean;
  citationsEnabled: boolean;
  /** Tenant workspace context block (trimmed); empty string when absent. */
  tenantWorkspaceContextBlock?: string;
  /** HNWI Desk Report v2.1 template slug when the client opts into structured desk output. */
  hnwiPromptTemplateV21Slug?: string;
  /** When true (scheduled user-task / reports Finance KB surface), extra citation placement rules apply. */
  scheduledDeskReportMode?: boolean;
};

export function computeXchatRemoteChainInstructionsFingerprint(
  input: XchatRemoteChainFingerprintInput
): string {
  const tenantCtx =
    typeof input.tenantWorkspaceContextBlock === "string"
      ? input.tenantWorkspaceContextBlock.trim()
      : "";
  const hnwiSlug =
    typeof input.hnwiPromptTemplateV21Slug === "string" ? input.hnwiPromptTemplateV21Slug.trim() : "";
  const override =
    typeof input.personaOverridePrompt === "string" ? input.personaOverridePrompt.trim() : "";
  const raw = [
    typeof input.personaSystem === "string" ? input.personaSystem : "",
    override,
    String(Number.isFinite(input.personaUpdatedAtMs) ? input.personaUpdatedAtMs : 0),
    input.strategyJobOptOut ? "1" : "0",
    input.hostedSearch ? "1" : "0",
    input.atxFunction ? "1" : "0",
    input.citationsEnabled ? "1" : "0",
    tenantCtx,
    hnwiSlug,
    input.scheduledDeskReportMode === true ? "1" : "0"
  ].join("\0");
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}

export type BuildXchatSystemPromptInput = {
  /** Optional first block: tenant workspace display context (white-label; not regulatory claims). */
  tenantWorkspaceContextBlock?: string | null;
  /** Trimmed or raw persona `systemPrompt`; empty uses `fallbackPersonaSystem`. */
  personaSystem: string;
  /**
   * Persona `overridePrompt` (stable per persona) — kept in **instructions** before volatile RAG/history/snapshot
   * so xAI prompt-caching can reuse the KV prefix across turns.
   */
  personaOverrideInstructions?: string | null;
  fallbackPersonaSystem: string;
  /** Snippet text only (no wrapper); empty → “No RAG context available.” */
  ragContext: string;
  /** Prior turns from Mongo `xchat_logs` (same tenant); omitted when empty. */
  recentHistoryBlock?: string | null;
  /** Multi-portfolio NL preflight (friendly names + ids); injected before workspace snapshot hint. */
  userWorkspaceSummaryBlock?: string | null;
  workspaceSnapshot: string | null | undefined;
  sessionToolInstructions: string;
  /** Ask route: enforced retrieval/tools/multi-agent policy blurb. */
  routingPolicyBlock?: string | null;
  /**
   * Persona-driven: include citation-chip contract vs plain-prose-only instruction.
   * Default true when omitted.
   */
  citationsEnabled?: boolean;
  /** Scheduled portfolio monitor / weekly summary — stricter citation placement (with reports RAG surface). */
  scheduledDeskReportMode?: boolean;
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
 * Locked order for **xAI prompt caching** (stable prefix first, volatile suffix last):
 * tenant display (optional) → persona system → persona override template (optional) → session tools → routing policy
 * → citation policy → optional scheduled desk report citation addendum → beta UI → RAG snippets → recent history → user workspace summary → workspace snapshot.
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
  const overrideRaw =
    typeof input.personaOverrideInstructions === "string" ? input.personaOverrideInstructions.trim() : "";
  const rag =
    typeof input.ragContext === "string" && input.ragContext.trim().length > 0
      ? `Use the following RAG context if relevant:\n${input.ragContext.trim()}`
      : "No RAG context available.";
  const stableParts: string[] = [];
  if (tenantCtx) {
    stableParts.push(tenantCtx);
  }
  stableParts.push(base);
  if (overrideRaw.length > 0) {
    stableParts.push(
      "Persona output template (stable — apply on every turn before answering the latest user message):\n" +
        overrideRaw
    );
  }
  const session = input.sessionToolInstructions.trim();
  if (session) {
    stableParts.push(session);
  }
  const routing = typeof input.routingPolicyBlock === "string" ? input.routingPolicyBlock.trim() : "";
  if (routing) {
    stableParts.push(routing);
  }
  stableParts.push(citationsEnabled ? XCHAT_CITATION_MARKDOWN_CONTRACT : XCHAT_NO_CITATIONS_INSTRUCTION);
  if (citationsEnabled && input.scheduledDeskReportMode === true) {
    stableParts.push(XCHAT_SCHEDULED_DESK_REPORT_CITATION_BLOCK);
  }
  stableParts.push(XCHAT_BETA_CLIENT_UI_INSTRUCTIONS);

  const volatileParts: string[] = [];
  volatileParts.push(rag);
  const hist =
    typeof input.recentHistoryBlock === "string" && input.recentHistoryBlock.trim().length > 0
      ? input.recentHistoryBlock.trim()
      : "";
  if (hist) {
    volatileParts.push(hist);
  }
  const wsSummary =
    typeof input.userWorkspaceSummaryBlock === "string" && input.userWorkspaceSummaryBlock.trim().length > 0
      ? input.userWorkspaceSummaryBlock.trim()
      : "";
  if (wsSummary) {
    volatileParts.push(wsSummary);
  }
  const snap =
    typeof input.workspaceSnapshot === "string" && input.workspaceSnapshot.trim().length > 0
      ? input.workspaceSnapshot.trim()
      : "";
  if (snap) {
    volatileParts.push(snap);
  }

  return [...stableParts, ...volatileParts].join("\n\n");
}
