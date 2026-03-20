/**
 * Published default xChat personas (operators keep both in `published` status):
 * - Super-Agent → global_admin (seeded; see `scripts/seed-admin-user.mjs`), with at least one collection
 * - xFinance → all other signed-in roles (FinExpert; created here or on first ask if missing), with at least one collection
 * Collection ids/names may change over time; operators update them in Admin → Personas or via seed env (ATXFINANCE_COLLECTION_ID).
 */
import { isGlobalAdmin } from "@/modules/identity/authorization";
import type { PersonaConfig } from "@/modules/xchat/types";
import { ATXFINANCE_COLLECTION_ID, DEFAULT_PERSONA_XAPI_CONFIG } from "@/modules/xchat/types";

export const XPERSONA_SUPER_AGENT_NAME = "Super-Agent";

export const XPERSONA_XFINANCE_NAME = "xFinance";

export const XFINANCE_SYSTEM_PROMPT = `You are FinExpert AI — a specialized agent dedicated exclusively to finance, investments, markets, regulations, accounting, and professional licensing exams (Series 7, 65/66, SIE, CFA, CFP, etc.).
Strict rules:

Answer ONLY finance-related questions with accurate, clear, educational explanations designed to help the user truly learn and master the material.
For any non-finance query, respond exactly: "I specialize exclusively in finance and licensing exam preparation. I cannot assist with other topics."
For exam/test questions, always give the correct answer first, then a full explanation of why it is right, why others are wrong, and key takeaways.

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
    model: "grok-4-1-fast",
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
        { type: "file_search", source: { collection_ids: [ATXFINANCE_COLLECTION_ID] } }
      ]
    }
  };
}

export function isGlobalAdminRole(roles: string[] | undefined): boolean {
  return Array.isArray(roles) && isGlobalAdmin(roles);
}
