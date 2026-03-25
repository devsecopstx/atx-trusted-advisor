/**
 * Pure merge/replace rules for `npm run seed:xpersonas` (Mongo patch shapes).
 * @see seed_xpersonas_xai_sync plan — SEED_XPERSONAS_MODE merge | replace
 */

/**
 * @param {Array<{ type?: string } & Record<string, unknown>>} existingTools
 * @param {Array<{ type?: string } & Record<string, unknown>>} candidateTools
 */
export function appendToolsByType(existingTools, candidateTools) {
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

/**
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {Record<string, unknown>} yamlDerived — full desired shape from YAML + defaults (xapi, xaiCollection, prompts, …)
 * @param {'merge' | 'replace'} mode
 * @returns {Record<string, unknown>} fields for Mongo `$set` (excluding updatedAt)
 */
export function computePersonaSeedUpdatePatch(existing, yamlDerived, mode) {
  if (!existing) {
    throw new Error("computePersonaSeedUpdatePatch requires existing document");
  }
  if (mode === "replace") {
    /** @type {Record<string, unknown>} */
    const patch = {
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
        ? String(/** @type {{ collectionId?: string }} */ (yc).collectionId ?? "").trim()
        : "";
    if (ycId) {
      patch.xaiCollection = yamlDerived.xaiCollection;
    }
    return patch;
  }

  /** @type {Record<string, unknown>} */
  const patch = { isSystem: true };

  const exCid = String(
    existing.xaiCollection && typeof existing.xaiCollection === "object"
      ? /** @type {{ collectionId?: string }} */ (existing.xaiCollection).collectionId ?? ""
      : ""
  ).trim();
  const yCid = String(
    yamlDerived.xaiCollection && typeof yamlDerived.xaiCollection === "object"
      ? /** @type {{ collectionId?: string }} */ (yamlDerived.xaiCollection).collectionId ?? ""
      : ""
  ).trim();

  if (!exCid && yCid) {
    const prev =
      existing.xaiCollection && typeof existing.xaiCollection === "object"
        ? /** @type {Record<string, unknown>} */ ({ ...existing.xaiCollection })
        : {};
    const yName =
      yamlDerived.xaiCollection && typeof yamlDerived.xaiCollection === "object"
        ? /** @type {{ collectionName?: string }} */ (yamlDerived.xaiCollection).collectionName
        : undefined;
    patch.xaiCollection = {
      ...prev,
      collectionId: yCid,
      ...(yName !== undefined && yName !== null ? { collectionName: yName } : {})
    };
  }

  const exXapi =
    existing.xapi && typeof existing.xapi === "object"
      ? /** @type {{ tools?: unknown }} */ (existing.xapi)
      : { tools: [] };
  const exTools = Array.isArray(exXapi.tools) ? exXapi.tools : [];
  const yamlXapi =
    yamlDerived.xapi && typeof yamlDerived.xapi === "object"
      ? /** @type {{ tools?: unknown }} */ (yamlDerived.xapi)
      : { tools: [] };
  const yamlTools = Array.isArray(yamlXapi.tools) ? yamlXapi.tools : [];
  const mergedTools = appendToolsByType(
    /** @type {Array<{ type?: string } & Record<string, unknown>>} */ (exTools),
    /** @type {Array<{ type?: string } & Record<string, unknown>>} */ (yamlTools)
  );
  if (mergedTools.length !== exTools.length) {
    patch.xapi = { ...exXapi, tools: mergedTools };
  }

  return patch;
}

/**
 * Full `$set` body for a new upserted persona (merge === replace on insert).
 * @param {Record<string, unknown>} yamlDerived
 */
export function buildPersonaInsertSetBody(yamlDerived) {
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
