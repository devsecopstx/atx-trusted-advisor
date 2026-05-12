import { getEnv } from "@/lib/env";
import {
    fetchXaiFileTextContent,
    hasXaiManagementApiKey,
    listXaiCollectionDocuments,
    listXaiCollections
} from "@/lib/xai";

import {
    getXaiFinanceCollectionId,
    XAI_FINANCE_COLLECTION_DISPLAY_NAME
} from "@/lib/xai-finance-collection";
import { computePersonaSeedUpdatePatch } from "@/modules/xchat/persona-seed-merge";
import {
    buildSyntheticPersonaDocFromIngestedFile,
    disambiguateSyncedPersonaDisplayName,
    friendlyDisplayNameForSyncedXpersona,
    loadPersonaDocFromUnknownText,
    shouldOfferSyntheticPersonaFromIngest
} from "@/modules/xchat/persona-spec-text";
import {
    buildYamlDerived,
    injectDefaultModel,
    resolveDefaultPersonaModelFromEnv,
    validateParsedPersonaDoc
} from "@/modules/xchat/persona-yaml-derived";
import {
    createPersona,
    getPersonaByNormalizedName,
    normalizePersonaNameKey,
    PersonaNameConflictError,
    updatePersona
} from "@/modules/xchat/repository";
import { normalizePersonaXapiConfig } from "@/modules/xchat/types";

export type SyncPersonasFromXaiResult = {
  collectionId: string;
  collectionDisplayName: string;
  /** Rows returned from xAI (after pagination). */
  listed: number;
  examined: number;
  imported: number;
  updated: number;
  skipped: number;
  /** Personas created/updated from plain-text fallback (non-YAML / no frontmatter). */
  syntheticFallbacks: number;
  errors: Array<{ source: string; message: string }>;
};

function nowSyncMeta(input: { actorUserId: string; collectionDisplayName: string }) {
  return {
    at: new Date(),
    byUserId: input.actorUserId,
    collectionDisplayName: input.collectionDisplayName
  };
}

export async function syncPersonasFromXaiCollection(input: {
  actorUserId: string;
  collectionDisplayName?: string;
  mode?: "merge" | "replace";
}): Promise<SyncPersonasFromXaiResult> {
  if (!hasXaiManagementApiKey()) {
    throw new Error("XAI_MANAGEMENT_API_KEY is required to sync personas from xAI");
  }

  const collectionDisplayName =
    input.collectionDisplayName?.trim() || XAI_FINANCE_COLLECTION_DISPLAY_NAME;
  const mode = input.mode === "replace" ? "replace" : "merge";
  const teamId = getEnv().XAI_TEAM_ID?.trim();
  const financeCollectionId = getXaiFinanceCollectionId();
  const collections = await listXaiCollections(teamId ? { teamId } : undefined);
  const want = collectionDisplayName.toLowerCase();
  const match =
    collections.find((c) => (c.name ?? "").trim().toLowerCase() === want) ??
    collections.find((c) => c.id?.trim() === financeCollectionId);
  if (!match?.id) {
    const err = new Error(
      `No xAI collection named "${collectionDisplayName}". Check seed RAG ingest and XAI_TEAM_ID.`
    );
    (err as Error & { code?: string }).code = "XAI_COLLECTION_NOT_FOUND";
    throw err;
  }

  const collectionId = match.id;
  const resolvedDisplayName = match.name?.trim() || collectionDisplayName;
  const documents = await listXaiCollectionDocuments(collectionId, {
    teamId: teamId || undefined
  });
  const defaultModel = resolveDefaultPersonaModelFromEnv();
  const colRef = { collectionId, collectionDisplayName: resolvedDisplayName };

  const result: SyncPersonasFromXaiResult = {
    collectionId,
    collectionDisplayName: resolvedDisplayName,
    listed: documents.length,
    examined: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    syntheticFallbacks: 0,
    errors: []
  };

  const syncMeta = () => nowSyncMeta({ actorUserId: input.actorUserId, collectionDisplayName: resolvedDisplayName });

  for (const doc of documents) {
    const label = doc.name?.trim() || doc.fileId;
    const source = `xai:${label}`;
    result.examined += 1;

    let text: string;
    try {
      text = await fetchXaiFileTextContent(doc.fileId);
    } catch (e) {
      result.errors.push({
        source,
        message: e instanceof Error ? e.message : String(e)
      });
      result.skipped += 1;
      continue;
    }

    let loaded = loadPersonaDocFromUnknownText(source, text);
    if (
      "error" in loaded &&
      shouldOfferSyntheticPersonaFromIngest({
        fileName: doc.name,
        contentType: doc.contentType
      })
    ) {
      const syn = buildSyntheticPersonaDocFromIngestedFile({
        sourceLabel: source,
        fileId: doc.fileId,
        displayFileName: doc.name,
        text
      });
      if (!("error" in syn)) {
        loaded = { rel: `${source}#synthetic`, doc: syn.doc };
        result.syntheticFallbacks += 1;
      }
    }
    if ("error" in loaded) {
      result.errors.push({ source, message: loaded.error });
      result.skipped += 1;
      continue;
    }

    const withModel = injectDefaultModel(loaded.doc, defaultModel);
    const displayName = friendlyDisplayNameForSyncedXpersona({
      yamlName: String(withModel.name ?? ""),
      fileName: doc.name,
      fileId: doc.fileId
    });
    const withFriendlyName = { ...withModel, name: displayName };
    const vErr = validateParsedPersonaDoc(withFriendlyName, loaded.rel, defaultModel);
    if (vErr) {
      result.errors.push({ source, message: vErr });
      result.skipped += 1;
      continue;
    }

    const derived = buildYamlDerived(withFriendlyName, colRef);
    const nameKey = normalizePersonaNameKey(derived.name);
    const existing = await getPersonaByNormalizedName(nameKey);
    const meta = syncMeta();

    if (!existing?._id) {
      const basePayload = {
        systemPrompt: derived.systemPrompt,
        overridePrompt: derived.overridePrompt || "",
        model: derived.model,
        temperature: derived.temperature,
        enableRag: derived.enableRag,
        defaultScope: derived.defaultScope,
        xaiCollection: {
          collectionId: derived.xaiCollection.collectionId ?? "",
          collectionName: derived.xaiCollection.collectionName
        },
        xapi: normalizePersonaXapiConfig(derived.xapi),
        status: "published" as const,
        version: 1,
        publishedAt: new Date(),
        isSystem: true,
        lastXaiPersonaSync: meta
      };
      let createName = derived.name;
      try {
        await createPersona({ ...basePayload, name: createName });
        result.imported += 1;
      } catch (e) {
        if (e instanceof PersonaNameConflictError) {
          try {
            createName = disambiguateSyncedPersonaDisplayName(derived.name, doc.fileId);
            await createPersona({ ...basePayload, name: createName });
            result.imported += 1;
          } catch (e2) {
            result.errors.push({
              source,
              message: e2 instanceof Error ? e2.message : String(e2)
            });
            result.skipped += 1;
          }
        } else {
          result.errors.push({
            source,
            message: e instanceof Error ? e.message : String(e)
          });
          result.skipped += 1;
        }
      }
      continue;
    }

    const patch = computePersonaSeedUpdatePatch(
      existing as unknown as Record<string, unknown>,
      derived as unknown as Record<string, unknown>,
      mode
    );
    const substantiveKeys = Object.keys(patch).filter((k) => k !== "isSystem");
    const payload =
      substantiveKeys.length === 0
        ? { lastXaiPersonaSync: meta }
        : { ...patch, lastXaiPersonaSync: meta };

    try {
      await updatePersona(existing._id.toHexString(), payload);
      result.updated += 1;
    } catch (e) {
      result.errors.push({
        source,
        message: e instanceof Error ? e.message : String(e)
      });
      result.skipped += 1;
    }
  }

  return result;
}
