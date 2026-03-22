/**
 * Published default xChat personas (operators keep both in `published` status):
 * - Super-Agent → global_admin (seeded; see `scripts/seed-admin-user.mjs`), with at least one collection
 * - xFinance → all other signed-in roles (FinExpert; created here or on first ask if missing), with at least one collection
 * Collection ids/names may change over time; operators update them in Admin → Personas or via seed env (ATXFINANCE_COLLECTION_ID).
 */
import { isGlobalAdmin } from "@/modules/identity/authorization";
import type { PersonaConfig } from "@/modules/xchat/types";
import { ATXFINANCE_COLLECTION_ID, DEFAULT_PERSONA_XAPI_CONFIG } from "@/modules/xchat/types";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

export const XPERSONA_SUPER_AGENT_NAME = "Super-Agent";

export const XPERSONA_XFINANCE_NAME = "xFinance";

/**
 * Appended when the persona exposes `web_search` and/or `x_search` — keeps tool-protocol guidance in
 * code instead of duplicating it in every persona `systemPrompt` (Super-Agent, xFinance, etc.).
 */
export const HOSTED_SEARCH_SESSION_TOOL_INSTRUCTIONS = `Hosted search (web_search / x_search):
Invoke these only through the API’s native tool mechanism. Do not print pseudo calls in assistant text—no \`<xai-tool>\`, \`<function_call>\`, fenced JSON tool blobs, or \`{"name":"web_search",...}\` payloads (users must never see markup). After the platform runs search, summarize results in plain language.`;

/** Appended to the ask-route system prompt whenever atxfinance is in the effective tool list (all app members + xFinance + admins with the tool). */
export const ATXFINANCE_SESSION_TOOL_INSTRUCTIONS = `Workspace tools (this signed-in user only):
When a "Workspace snapshot" JSON block appears in system context, it was loaded server-side for this turn—use it as authoritative for portfolio, accounts, watchlist, and the positions preview; call atxfinance for a full positions refresh, live market_quote, task_status, or if you suspect the snapshot is stale.
You MUST use the atxfinance tool when the user asks about their own portfolio, accounts, cash balances, watchlist tickers, or stock/option positions (holdings). Call it before answering—do not ask them to paste holdings or balances if a tool can retrieve them.
When the user asks to add or remove watchlist symbols (e.g. "add NVDA to my watchlist", "remove AAPL"), call watchlist_add_symbols or watchlist_remove_symbols with symbol or symbols—then confirm the updated list briefly.
Use real atxfinance function calls via the API. For open positions/holdings (symbol, qty, avg cost), set operation to positions_snapshot; for balances and account overview use portfolio_summary or account_health. Prefer native API tool calls only—do not print \`<function_call>\`, \`<xai-tool>\`, or fenced JSON tool stubs in assistant text (users must never see pseudo markup; one native call can follow another if needed).
Operations: portfolio_summary (overview, per-account cashBalance, position counts), positions_snapshot (symbol, qty, avgCost per account; may truncate), watchlist_snapshot (symbols + addedAt), watchlist_add_symbols / watchlist_remove_symbols (pass symbol or symbols array), account_health (balances + default account). For live quotes use yahoo_finance or atxfinance with operation market_quote.
If the tool returns no_default_portfolio, no_watchlist, or empty positions, say that clearly and suggest completing setup in Portfolio / Watchlist in the app—not a generic request to "share your holdings."`;

// TODO(operators/prompt): Do not list atxfinance operations (portfolio_summary, etc.) in overridePrompt — that field is prepended to every user turn. Tool guidance is injected as system text (ATXFINANCE_SESSION_TOOL_INSTRUCTIONS) and is not synced to the user xAI collection; only prompt/response turns are. systemPrompt may optionally add one line for tone; operation enums are redundant with injection.
export const XFINANCE_SYSTEM_PROMPT = `You are FinExpert AI — a specialized agent dedicated exclusively to finance, investments, markets, regulations, accounting, and professional licensing exams (Series 7, 65/66, SIE, CFA, CFP, etc.).
Strict rules:

Answer ONLY finance-related questions with accurate, clear, educational explanations designed to help the user truly learn and master the material.
For any non-finance query, respond exactly: "I specialize exclusively in finance and licensing exam preparation. I cannot assist with other topics."
For exam/test questions, always give the correct answer first, then a full explanation of why it is right, why others are wrong, and key takeaways.

When the user asks about their personal portfolio, watchlist, or positions in this app, use the atxfinance tool to load their workspace data before replying—do not ask them to manually type what is already available via tools.

Stay professional, concise, and learning-focused at all times.`;

export type DefaultXfinancePersonaInsert = Omit<
  PersonaConfig,
  "_id" | "createdAt" | "updatedAt" | "nameNormalized"
>;

/** Default RAG collection for xFinance (and optionally Super-Agent); may change over time. */
export const DEFAULT_XFINANCE_COLLECTION_NAME = "Finance";
export function buildDefaultXfinancePersonaPayload(): DefaultXfinancePersonaInsert {
  return {
    name: XPERSONA_XFINANCE_NAME,
    systemPrompt: XFINANCE_SYSTEM_PROMPT,
    overridePrompt: "",
    model: XAI_PERSONA_CHAT_MODEL_FALLBACK_ID,
    temperature: 0.2,
    enableRag: true,
    defaultScope: "global",
    status: "published",
    version: 1,
    publishedAt: new Date(),
    xaiCollection: {
      collectionId: ATXFINANCE_COLLECTION_ID,
      collectionName: DEFAULT_XFINANCE_COLLECTION_NAME
    },
    xapi: {
      ...DEFAULT_PERSONA_XAPI_CONFIG,
      tools: [
        { type: "web_search" },
        { type: "x_search" },
        { type: "collections_search", collection_ids: [ATXFINANCE_COLLECTION_ID] },
        { type: "yahoo_finance" },
        { type: "atxfinance" }
      ]
    }
  };
}

export function isGlobalAdminRole(roles: string[] | undefined): boolean {
  return Array.isArray(roles) && isGlobalAdmin(roles);
}
