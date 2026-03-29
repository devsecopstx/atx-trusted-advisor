/**
 * Derive Mongo/API persona fields from parsed YAML/frontmatter docs (seed:xpersonas + xAI collection sync).
 */
import { getEnv } from "@/lib/env";

import type { PersonaXapiConfig, PersonaXapiToolDefinition } from "@/modules/xchat/types";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

function coerceBool(v: unknown, defaultVal = true): boolean {
  if (v === undefined || v === null) {
    return defaultVal;
  }
  if (typeof v === "boolean") {
    return v;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "false" || s === "0" || s === "no") {
    return false;
  }
  if (s === "true" || s === "1" || s === "yes") {
    return true;
  }
  return defaultVal;
}

function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", ".").trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

function buildSeedPersonaTools(collectionId: string): PersonaXapiToolDefinition[] {
  const cid = collectionId.trim();
  if (cid) {
    return [
      { type: "atx_function" },
      { type: "collections_search", collection_ids: [cid] },
      { type: "yahoo_finance" },
      { type: "web_search" },
      { type: "x_search" },
      { type: "code_interpreter" }
    ];
  }
  return [
    { type: "atx_function" },
    { type: "yahoo_finance" },
    { type: "web_search" },
    { type: "x_search" },
    { type: "code_interpreter" }
  ];
}

function buildXapiFromYamlDoc(raw: Record<string, unknown>, collectionId: string): PersonaXapiConfig {
  const defaultTools = buildSeedPersonaTools(collectionId);
  const x = raw.xapi;
  if (x && typeof x === "object" && x !== null && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    const mode = typeof o.mode === "string" ? o.mode : "responses";
    const toolChoice = typeof o.toolChoice === "string" ? o.toolChoice : "auto";
    const maxTurns = coerceNumber(o.maxTurns, 5);
    const tools = Array.isArray(o.tools) && o.tools.length > 0 ? o.tools : defaultTools;
    return {
      mode: mode === "chat_completions" ? "chat_completions" : "responses",
      toolChoice:
        toolChoice === "required" || toolChoice === "none"
          ? toolChoice
          : "auto",
      maxTurns: Math.min(10, Math.max(1, Math.floor(maxTurns))),
      tools: tools as PersonaXapiToolDefinition[]
    };
  }
  return {
    mode: "responses",
    toolChoice: "auto",
    maxTurns: 5,
    tools: defaultTools
  };
}

export type YamlDerivedPersona = {
  name: string;
  systemPrompt: string;
  overridePrompt: string;
  model: string;
  enableRag: boolean;
  defaultScope: string;
  temperature: number;
  xaiCollection: { collectionId?: string; collectionName?: string };
  xapi: PersonaXapiConfig;
};

export function buildYamlDerived(
  doc: Record<string, unknown>,
  col: { collectionId: string; collectionDisplayName: string }
): YamlDerivedPersona {
  const name = String(doc.name ?? "").trim();
  const systemPrompt = String(doc.system_prompt ?? "").trim();
  const overridePrompt = typeof doc.override_prompt === "string" ? doc.override_prompt.trim() : "";
  const model = String(doc.model ?? "").trim();
  const enableRag = coerceBool(doc.enable_rag, true);
  const defaultScope = String(doc.default_scope ?? "global").trim() || "global";
  const temperature = coerceNumber(doc.temperature, 0.2);
  const t = Math.min(1, Math.max(0, temperature));

  const xaiCollection: { collectionId?: string; collectionName?: string } = {};
  if (col.collectionId) {
    xaiCollection.collectionId = col.collectionId;
    xaiCollection.collectionName = col.collectionDisplayName || undefined;
  }

  return {
    name,
    systemPrompt,
    overridePrompt,
    model,
    enableRag,
    defaultScope,
    temperature: t,
    xaiCollection,
    xapi: buildXapiFromYamlDoc(doc, col.collectionId)
  };
}

export function resolveDefaultPersonaModelFromEnv(): string {
  const fromEnv = String(getEnv().XAI_CHAT_MODEL ?? "").trim();
  return fromEnv || XAI_PERSONA_CHAT_MODEL_FALLBACK_ID;
}

export function injectDefaultModel(doc: Record<string, unknown>, defaultModel: string): Record<string, unknown> {
  if (!String(doc.model ?? "").trim()) {
    return { ...doc, model: defaultModel };
  }
  return doc;
}

export function validateParsedPersonaDoc(parsed: unknown, fileLabel: string, defaultModel: string): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return `${fileLabel}: invalid document root`;
  }
  const o = parsed as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return `${fileLabel}: name must be 2–80 chars`;
  }
  const sp = String(o.system_prompt ?? "").trim();
  if (sp.length < 10) {
    return `${fileLabel}: system_prompt must be at least 10 characters`;
  }
  const model = String(o.model ?? "").trim() || defaultModel;
  if (!model) {
    return `${fileLabel}: model is required (set model in file or XAI_CHAT_MODEL)`;
  }
  if (model.length > 120) {
    return `${fileLabel}: model too long`;
  }
  return null;
}
