import type { PersonaConfig } from "@/modules/xchat/types";
import { DEFAULT_PERSONA_XAPI_CONFIG } from "@/modules/xchat/types";

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

export function buildDefaultXfinancePersonaPayload(): DefaultXfinancePersonaInsert {
  return {
    name: XPERSONA_XFINANCE_NAME,
    systemPrompt: XFINANCE_SYSTEM_PROMPT,
    overridePrompt: "",
    model: "grok-4-1-fast",
    temperature: 0.2,
    enableRag: false,
    defaultScope: "global",
    status: "published",
    version: 1,
    publishedAt: new Date(),
    xapi: {
      ...DEFAULT_PERSONA_XAPI_CONFIG,
      tools: [{ type: "web_search" }]
    }
  };
}

export function isGlobalAdminRole(roles: string[] | undefined): boolean {
  return Array.isArray(roles) && roles.includes("global_admin");
}
