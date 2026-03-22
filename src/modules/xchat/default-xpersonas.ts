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

// Session tool copy for ask/batch lives in `buildSessionToolInstructions` (`xchat-prompt-build.ts`).
// TODO(operators/prompt): Do not list atxfinance operations in overridePrompt — tool guidance is injected via `buildSessionToolInstructions`; not synced to the user xAI collection.
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
