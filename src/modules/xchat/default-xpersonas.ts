/**
 * Published default xChat personas (operators keep both in `published` status):
 * - advisor → global_admin default and **platform** app-user default when `seed:admin` sets `xchat_platform_settings.defaultAppUserPersonaId` (see `advisor/advisor.yaml`)
 * - atx-trusted-advisor → fallback when platform default is unset/cleared, with at least one collection
 * Collection ids/names may change over time; operators update them in Admin → Personas or via `XAI_TEAM_ID` (collection id or team UUID).
 */
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getTeamXaiKbCollectionIdSync } from "@/modules/xchat/team-xai-collection";
import type { PersonaConfig, PersonaXapiToolDefinition } from "@/modules/xchat/types";
import { DEFAULT_PERSONA_XAPI_CONFIG } from "@/modules/xchat/types";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

/** Display `name` for the seeded global_admin default persona (disk: `xpersonas/advisor/advisor.yaml`). */
export const XPERSONA_DEFAULT_GLOBAL_ADMIN_NAME = "advisor";

/**
 * Lowercase persona name keys treated as global-admin defaults: hidden from app_user picker unless assigned;
 * same keys used in ask-route gating. Includes legacy `super-agent` rows until migrated.
 */
export const XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS = ["advisor", "super-agent"] as const;

export const XPERSONA_TRUSTED_ADVISOR_NAME = "atx-trusted-advisor";

// Session tool copy for ask/batch lives in `buildSessionToolInstructions` (`xchat-prompt-build.ts`).
// TODO(operators/prompt): Do not list atxfinance operations in overridePrompt — tool guidance is injected via `buildSessionToolInstructions`; not synced to the user xAI collection.
export const TRUSTED_ADVISOR_SYSTEM_PROMPT = `**Trusted Family Advisor Persona**

You are a licensed fiduciary financial advisor and options strategist with 20+ years advising high-net-worth families. Speak plainly, conservatively, and protectively—like to a trusted family member—while always factoring in tax efficiency, legal compliance, and regulatory suitability.

Your mission: Explain the mechanics, risks, rewards, and tax/legal nuances of the top 10 proven options strategies (covered calls, protective puts, credit spreads, iron condors, straddles/strangles, etc.) to help grow the portfolio 1-2% weekly or bi-weekly through disciplined, capital-preserving trades. Prioritize safety first, never over-promise, and always tie recommendations to current market conditions and the client's risk profile.

When the user asks about their personal portfolio, watchlist, or positions in this app, use the atx_function tool to load their workspace data before replying—do not ask them to manually type what is already available via tools.

For topics outside finance, investing, and related planning, politely decline and offer to help with financial questions instead.`;

export type DefaultTrustedAdvisorPersonaInsert = Omit<
  PersonaConfig,
  "_id" | "createdAt" | "updatedAt" | "nameNormalized"
>;

/** Default RAG collection name for non-admin fallback persona; may change over time. */
export const DEFAULT_TRUSTED_ADVISOR_COLLECTION_NAME = "atx-trusted-advisor";
export function buildDefaultTrustedAdvisorPersonaPayload(): DefaultTrustedAdvisorPersonaInsert {
  const cid = getTeamXaiKbCollectionIdSync();
  const tools: PersonaXapiToolDefinition[] = [
    { type: "atx_function" },
    ...(cid ? [{ type: "collections_search", collection_ids: [cid] } as PersonaXapiToolDefinition] : []),
    { type: "yahoo_finance" },
    { type: "web_search" },
    { type: "x_search" },
    { type: "code_interpreter" }
  ];
  return {
    name: XPERSONA_TRUSTED_ADVISOR_NAME,
    systemPrompt: TRUSTED_ADVISOR_SYSTEM_PROMPT,
    overridePrompt: "",
    model: XAI_PERSONA_CHAT_MODEL_FALLBACK_ID,
    temperature: 0.2,
    enableRag: true,
    defaultScope: "global",
    status: "published",
    version: 1,
    publishedAt: new Date(),
    xaiCollection: {
      collectionId: cid,
      collectionName: DEFAULT_TRUSTED_ADVISOR_COLLECTION_NAME
    },
    xapi: {
      ...DEFAULT_PERSONA_XAPI_CONFIG,
      tools
    }
  };
}

export function isGlobalAdminRole(roles: string[] | undefined): boolean {
  return Array.isArray(roles) && isGlobalAdmin(roles);
}
