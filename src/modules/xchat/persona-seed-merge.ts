/**
 * Pure merge/replace rules for `npm run seed:xpersonas` (Mongo `$set` patch shapes).
 * @see plan: seed:xpersonas xAI sync — SEED_XPERSONAS_MODE merge | replace
 */

export type PersonaSeedTool = { type?: string } & Record<string, unknown>;

export function appendToolsByType(
  existingTools: PersonaSeedTool[] | undefined,
  candidateTools: PersonaSeedTool[]
): PersonaSeedTool[] {
  const have = new Set(
    (Array.isArray(existingTools) ? existingTools : [])
      .map((t) => String(t?.type ?? "").trim())
      .filter(Boolean)
  );
  const out = [...(Array.isArray(existingTools) ? existingTools : [])];
  for (const t of candidateTools) {
    const ty = String(t?.type ?? "").trim();
    if (!ty || have.has(ty)) {
      continue;
    }
    out.push({ ...t });
    have.add(ty);
  }
  return out;
}

type YamlDerivedSeed = Record<string, unknown>;

export function computePersonaSeedUpdatePatch(
  existing: YamlDerivedSeed | null | undefined,
  yamlDerived: YamlDerivedSeed,
  mode: "merge" | "replace"
): Record<string, unknown> {
  if (!existing) {
    throw new Error("computePersonaSeedUpdatePatch requires existing document");
  }
  if (mode === "replace") {
    const patch: Record<string, unknown> = {
      systemPrompt: yamlDerived.systemPrompt,
      overridePrompt: yamlDerived.overridePrompt,
      enableRag: yamlDerived.enableRag,
      defaultScope: yamlDerived.defaultScope,
      model: yamlDerived.model,
      temperature: yamlDerived.temperature,
      xapi: yamlDerived.xapi,
      isSystem: true
    };
    const yc = yamlDerived.xaiCollection;
    const ycId =
      yc && typeof yc === "object"
        ? String((yc as { collectionId?: string }).collectionId ?? "").trim()
        : "";
    if (ycId) {
      patch.xaiCollection = yamlDerived.xaiCollection;
    }
    return patch;
  }

  const patch: Record<string, unknown> = { isSystem: true };

  const exCid = String(
    existing.xaiCollection && typeof existing.xaiCollection === "object"
      ? (existing.xaiCollection as { collectionId?: string }).collectionId ?? ""
      : ""
  ).trim();
  const yCid = String(
    yamlDerived.xaiCollection && typeof yamlDerived.xaiCollection === "object"
      ? (yamlDerived.xaiCollection as { collectionId?: string }).collectionId ?? ""
      : ""
  ).trim();

  if (!exCid && yCid) {
    const prev =
      existing.xaiCollection && typeof existing.xaiCollection === "object"
        ? { ...(existing.xaiCollection as Record<string, unknown>) }
        : {};
    const yName =
      yamlDerived.xaiCollection && typeof yamlDerived.xaiCollection === "object"
        ? (yamlDerived.xaiCollection as { collectionName?: string }).collectionName
        : undefined;
    patch.xaiCollection = {
      ...prev,
      collectionId: yCid,
      ...(yName !== undefined && yName !== null ? { collectionName: yName } : {})
    };
  }

  const exXapi =
    existing.xapi && typeof existing.xapi === "object"
      ? (existing.xapi as { tools?: unknown })
      : { tools: [] };
  const exTools = Array.isArray(exXapi.tools) ? exXapi.tools : [];
  const yamlXapi =
    yamlDerived.xapi && typeof yamlDerived.xapi === "object"
      ? (yamlDerived.xapi as { tools?: unknown })
      : { tools: [] };
  const yamlTools = Array.isArray(yamlXapi.tools) ? yamlXapi.tools : [];
  const mergedTools = appendToolsByType(
    exTools as PersonaSeedTool[],
    yamlTools as PersonaSeedTool[]
  );
  if (mergedTools.length !== exTools.length) {
    patch.xapi = { ...exXapi, tools: mergedTools };
  }

  return patch;
}

export function buildPersonaInsertSetBody(yamlDerived: YamlDerivedSeed): Record<string, unknown> {
  return {
    systemPrompt: yamlDerived.systemPrompt,
    overridePrompt: yamlDerived.overridePrompt,
    xaiCollection: yamlDerived.xaiCollection,
    model: yamlDerived.model,
    temperature: yamlDerived.temperature,
    enableRag: yamlDerived.enableRag,
    defaultScope: yamlDerived.defaultScope,
    xapi: yamlDerived.xapi,
    isSystem: true
  };
}
