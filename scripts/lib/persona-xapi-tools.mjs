/** Default xAPI tool lists for seeded personas (see seed-admin-user.mjs). */

/** @param {string[]} ids */
export function dedupeTrimmedIds(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const t = String(id ?? "").trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * @param {string | string[] | undefined} collectionIds
 * @returns {Array<Record<string, unknown>>}
 */
export function buildSuperAgentXapiTools(collectionIds) {
  const list = Array.isArray(collectionIds)
    ? dedupeTrimmedIds(collectionIds)
    : dedupeTrimmedIds(collectionIds ? [collectionIds] : []);
  if (list.length > 0) {
    return [
      { type: "web_search" },
      { type: "x_search" },
      { type: "collections_search", collection_ids: list },
      { type: "yahoo_finance" },
      { type: "atxfinance" }
    ];
  }
  return [{ type: "web_search" }, { type: "x_search" }, { type: "yahoo_finance" }, { type: "atxfinance" }];
}

/**
 * Global-admin **advisor** preset: `atx_function` + `yahoo_finance` + optional `file_search` with **one** collection id.
 * @param {string | string[] | undefined} collectionIds
 * @returns {Array<Record<string, unknown>>}
 */
export function buildAdvisorXapiTools(collectionIds) {
  const list = Array.isArray(collectionIds)
    ? dedupeTrimmedIds(collectionIds)
    : dedupeTrimmedIds(collectionIds ? [collectionIds] : []);
  const primary = list[0];
  const out = [{ type: "atx_function" }, { type: "yahoo_finance" }];
  if (primary) {
    out.push({ type: "file_search", collection_ids: [primary] });
  }
  return out;
}
