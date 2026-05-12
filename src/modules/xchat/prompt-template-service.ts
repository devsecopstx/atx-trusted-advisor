import type { Db } from "mongodb";

import {
  buildWorkspacePreloadHintForSystemPrompt,
  loadWorkspaceSnapshotPreload,
  type WorkspaceSnapshotContext
} from "@/modules/xchat/workspace-snapshot-for-prompt";
import { findActivePromptTemplateForTenant } from "@/modules/xchat/prompt-template-repository";
import {
  getBuiltinHnwiV21PromptText,
  HNWI_PROMPT_TEMPLATE_V21_VERSION,
  type HnwiPromptTemplateV21Slug
} from "@/modules/xchat/prompt-templates-v21-defaults";
import { HNWI_DESK_REPORT_V21_TITLE } from "@/modules/xchat/xchat-hnwi-v21-desk-report";

export type ResolveHnwiV21ComposerPackageResult = {
  slug: HnwiPromptTemplateV21Slug;
  templateVersion: string;
  resolvedSource: "mongo_tenant" | "mongo_global" | "builtin";
  composerText: string;
};

/**
 * Resolves HNWI v2.1 template body (Mongo `prompt_templates` override or built-in),
 * merges workspace snapshot for the scoped portfolio when available.
 */
export async function resolveHnwiV21ComposerPackage(input: {
  db: Db;
  slug: HnwiPromptTemplateV21Slug;
  tenantIdHex: string | undefined;
  sessionUserId: string;
  portfolioIdHex?: string | null;
  coordinatingRequest?: Request;
}): Promise<ResolveHnwiV21ComposerPackageResult> {
  const row = await findActivePromptTemplateForTenant(input.db, input.slug, input.tenantIdHex);
  const promptText = row?.prompt_text?.trim()?.length ? row.prompt_text.trim() : getBuiltinHnwiV21PromptText(input.slug);
  const templateVersion = row?.version?.trim()?.length ? row.version.trim() : HNWI_PROMPT_TEMPLATE_V21_VERSION;
  let resolvedSource: ResolveHnwiV21ComposerPackageResult["resolvedSource"] = "builtin";
  if (row) {
    resolvedSource = row.tenantId ? "mongo_tenant" : "mongo_global";
  }

  const ctx: WorkspaceSnapshotContext = {
    userId: input.sessionUserId,
    tenantId: input.tenantIdHex,
    workspacePortfolioId: input.portfolioIdHex?.trim() || null
  };
  const preload = await loadWorkspaceSnapshotPreload(ctx, {
    coordinatingRequest: input.coordinatingRequest,
    snapshotQuoteNetwork: "cached_first"
  });
  const workspaceBlock = preload
    ? buildWorkspacePreloadHintForSystemPrompt(preload).trim()
    : "Workspace snapshot unavailable for this request — proceed with general guidance and ask for missing fields.";

  const header = `[${HNWI_DESK_REPORT_V21_TITLE} | slug=${input.slug} | version=${templateVersion}]`;

  const composerText = [
    header,
    "",
    promptText,
    "",
    "---",
    "Workspace context (authoritative when present):",
    workspaceBlock
  ].join("\n");

  return {
    slug: input.slug,
    templateVersion,
    resolvedSource,
    composerText
  };
}
