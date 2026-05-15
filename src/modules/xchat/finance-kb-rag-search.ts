import { searchDocumentsInCollections, type XaiCollectionSearchSnippet } from "@/lib/xai";
import { getXaiFinanceCollectionId } from "@/lib/xai-finance-collection";
import type { UserWorkspaceSummaryJson } from "@/modules/xchat/user-workspace-summary-for-prompt";

export type FinanceKbRagSurface = "xchat" | "reports";

const STRATEGY_TOKEN_TO_TYPES: ReadonlyArray<{ re: RegExp; types: string[] }> = [
  { re: /\bwheel\b/i, types: ["wheel"] },
  { re: /\biron\s*condor\b/i, types: ["iron_condor"] },
  { re: /\bjade\s*lizard\b/i, types: ["iron_condor"] },
  { re: /\bcovered\s*call\b|\bcc\s+position\b|\bshort\s+calls?\b/i, types: ["covered_call"] },
  { re: /\bcash[-\s]?secured\s*put\b|\bcsp\b/i, types: ["covered_call", "wheel"] },
  { re: /\bput\s*credit\s*spread\b|\bbpcs\b|\bbull\s*put\b/i, types: ["bull_put_credit_spread"] },
  { re: /\bcall\s*debit\s*spread\b|\bcds\b|\bbull\s*call\b/i, types: ["bull_call_debit_spread"] },
  { re: /\bcalendar\b/i, types: ["calendar_spread"] },
  { re: /\bdiagonal\b/i, types: ["diagonal_spread"] },
  { re: /\bbroken\s*wing\b|\bbwb\b/i, types: ["broken_wing_butterfly"] },
  { re: /\bstraddle\b|\bstrangle\b/i, types: ["straddle"] },
  { re: /\bearnings\b/i, types: ["earnings_event"] },
  { re: /\bpmcc\b|poor\s*man'?s\s*covered\s*call/i, types: ["poor_mans_covered_call"] },
  { re: /\bvolatility\b|\biv\s+crush\b|\biv\s+rank\b/i, types: ["volatility_indicators"] },
  { re: /\btax\b|\bwash\s*sale\b|\bstraddle\s*rule\b/i, types: ["tax_compliance"] },
  { re: /\bposition\s*sizing\b|\bsizing\b/i, types: ["position_sizing"] },
  { re: /\bpayoff\b|\breference\b/i, types: ["payoff_reference"] },
  { re: /\boptions\s+101\b|\bcore\s*skills\b|\bcatalog\b/i, types: ["strategy_index"] }
];

/** xAI `/v1/documents/search` `filter` uses AIP-160 string syntax (not Mongo operators). */
export function buildResponseGuidelinesAip160Filter(surface: FinanceKbRagSurface): string {
  if (surface === "reports") {
    return `(surface = "reports" OR doc_type = "compliance")`;
  }
  return `(surface = "xchat" OR doc_type = "compliance")`;
}

export function inferStrategyTypesFromUserMessage(message: string): string[] {
  const out = new Set<string>();
  const m = message.trim();
  if (!m) {
    return [];
  }
  for (const row of STRATEGY_TOKEN_TO_TYPES) {
    if (row.re.test(m)) {
      for (const t of row.types) {
        out.add(t);
      }
    }
  }
  return [...out];
}

export function inferRiskLevelsFromUserMessage(message: string): string[] {
  const m = message.toLowerCase();
  const out = new Set<string>();
  if (/\bconservative\b|\blow\s*risk\b|\bcapital\s*preservation\b/i.test(m)) {
    out.add("conservative");
  }
  if (/\bbalanced\b|\bmoderate\b|\bmedium\s*risk\b/i.test(m)) {
    out.add("balanced");
  }
  if (/\baggressive\b|\bhigh\s*risk\b|\bgrowth\b(?!\s*stock)/i.test(m)) {
    out.add("aggressive");
  }
  return [...out];
}

/** Maps desk summary labels to Finance KB frontmatter `risk_level` values. */
export function workspaceSummaryRiskToKbRiskLevels(risk: string | null | undefined): string[] {
  if (!risk) {
    return [];
  }
  const n = risk.trim().toLowerCase();
  if (n === "conservative") {
    return ["conservative"];
  }
  if (n === "moderate" || n === "balanced") {
    return ["balanced"];
  }
  if (n === "aggressive") {
    return ["aggressive"];
  }
  return [];
}

export function resolveWorkspaceKbRiskLevels(summary: UserWorkspaceSummaryJson | null): string[] {
  if (!summary?.workspace?.portfolios?.length) {
    return [];
  }
  const activeId = summary.workspace.activePortfolioId?.trim();
  const rows = summary.workspace.portfolios;
  const preferred = activeId
    ? rows.find((r) => r.id === activeId) ?? rows[0]
    : rows[0];
  return workspaceSummaryRiskToKbRiskLevels(preferred?.riskLevel ?? null);
}

export function userRequestedAdvancedComplexity(message: string): boolean {
  return /\badvanced\b|\bmulti[-\s]?leg\b|\bcomplex\b|\bexotic\b|\b(leaps?|leap)\b/i.test(message);
}

export function buildOptionsPlaybooksAip160Filter(input: {
  strategyTypes: string[];
  riskLevels: string[];
  complexity: "core" | "advanced";
}): string {
  const parts: string[] = [
    '(category = "options-strategy-core" OR category = "options-strategy-advanced")',
    `complexity = "${escapeAip160String(input.complexity)}"`
  ];
  if (input.strategyTypes.length > 0) {
    const ors = input.strategyTypes.map((t) => `strategy_type = "${escapeAip160String(t)}"`).join(" OR ");
    parts.push(`(${ors})`);
  }
  if (input.riskLevels.length > 0) {
    const ors = input.riskLevels.map((t) => `risk_level = "${escapeAip160String(t)}"`).join(" OR ");
    parts.push(`(${ors})`);
  }
  return parts.join(" AND ");
}

/** Desk literacy segment uploaded with `category = "finance-core"` metadata. */
export function buildFinanceCoreDeskAip160Filter(): string {
  return 'category = "finance-core"';
}

function escapeAip160String(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function snippetKey(s: XaiCollectionSearchSnippet): string {
  const id = s.documentId ?? "";
  const head = s.text.slice(0, 120);
  return `${id}::${head}`;
}

export function mergeDedupeFinanceKbSnippets(
  a: XaiCollectionSearchSnippet[],
  b: XaiCollectionSearchSnippet[],
  limit: number
): XaiCollectionSearchSnippet[] {
  const seen = new Set<string>();
  const out: XaiCollectionSearchSnippet[] = [];
  for (const row of [...a, ...b]) {
    const k = snippetKey(row);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(row);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

async function searchCollectionWithFilterFallback(input: {
  query: string;
  collectionIds: string[];
  limit: number;
  filter: string | null;
  logLabel: string;
}): Promise<XaiCollectionSearchSnippet[]> {
  if (input.filter && input.filter.trim().length > 0) {
    try {
      const hit = await searchDocumentsInCollections({
        query: input.query,
        collectionIds: input.collectionIds,
        limit: input.limit,
        filter: input.filter
      });
      if (hit.length > 0) {
        return hit;
      }
    } catch (error) {
      console.warn(`[xchat/rag] ${input.logLabel} filtered search failed; retrying unfiltered`, {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return searchDocumentsInCollections({
    query: input.query,
    collectionIds: input.collectionIds,
    limit: input.limit
  });
}

/**
 * Pre-search for the shared Finance xAI collection: response guidelines, finance-core desk
 * literacy (`category = "finance-core"`), and options playbooks (metadata-aligned), merged up to
 * `limit`. Falls back to unfiltered search per leg when filters return nothing or the vendor rejects
 * the filter string.
 */
export async function searchFinanceKbCollectionForXchatPreRag(input: {
  query: string;
  limit: number;
  surface?: FinanceKbRagSurface;
  userMessage: string;
  workspaceSummary: UserWorkspaceSummaryJson | null;
  /** When false, single unfiltered search (legacy behavior). */
  enableMetadataFilters?: boolean;
}): Promise<XaiCollectionSearchSnippet[]> {
  const collectionId = getXaiFinanceCollectionId().trim();
  const collectionIds = [collectionId];
  const limit = Math.max(1, Math.floor(input.limit));
  const enable = input.enableMetadataFilters !== false;

  if (!enable) {
    return searchDocumentsInCollections({
      query: input.query,
      collectionIds,
      limit
    });
  }

  const surface = input.surface ?? "xchat";
  const guidelinesLimit = Math.max(2, Math.floor(limit * 0.32));
  const financeCoreLimit = Math.max(1, Math.floor(limit * 0.22));
  const optionsLimit = Math.max(2, limit - guidelinesLimit - financeCoreLimit);

  const guidelinesFilter = buildResponseGuidelinesAip160Filter(surface);
  const guidelinesSnippets = await searchCollectionWithFilterFallback({
    query: input.query,
    collectionIds,
    limit: guidelinesLimit,
    filter: guidelinesFilter,
    logLabel: "guidelines"
  });

  const financeCoreFilter = buildFinanceCoreDeskAip160Filter();
  const financeCoreSnippets = await searchCollectionWithFilterFallback({
    query: input.query,
    collectionIds,
    limit: financeCoreLimit,
    filter: financeCoreFilter,
    logLabel: "finance_core"
  });

  const strategyTypes = inferStrategyTypesFromUserMessage(input.userMessage);
  const msgRisks = inferRiskLevelsFromUserMessage(input.userMessage);
  const wsRisks = resolveWorkspaceKbRiskLevels(input.workspaceSummary);
  const riskLevels = Array.from(new Set([...msgRisks, ...wsRisks]));
  const complexity = userRequestedAdvancedComplexity(input.userMessage) ? "advanced" : "core";

  const optionsFilter = buildOptionsPlaybooksAip160Filter({
    strategyTypes,
    riskLevels,
    complexity
  });

  const optionsSnippets = await searchCollectionWithFilterFallback({
    query: input.query,
    collectionIds,
    limit: optionsLimit,
    filter: optionsFilter,
    logLabel: "options_playbooks"
  });

  const mergedGo = mergeDedupeFinanceKbSnippets(guidelinesSnippets, optionsSnippets, limit);
  const merged = mergeDedupeFinanceKbSnippets(mergedGo, financeCoreSnippets, limit);
  if (merged.length > 0) {
    return merged;
  }
  return searchDocumentsInCollections({
    query: input.query,
    collectionIds,
    limit
  });
}
