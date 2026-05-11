import type { XaiCollectionSearchSnippet } from "@/lib/xai";
import { normalizePositionType } from "@/modules/core-admin/types";

import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

/** Narrow match: HNWI “holdings + watchlist → wheel / CC ideas” template. */
export function shouldOptimizeIncomeIdeasPrompt(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) {
    return false;
  }
  const holdingsPlusWatchlist =
    m.includes("from holdings") || (m.includes("holdings") && m.includes("watchlist"));
  const wantsIdeas =
    /\bideas?\b/.test(m) &&
    (/\bcovered[- ]calls?\b/.test(m) ||
      /\bcovered call\b/.test(m) ||
      /\bwheel\b/.test(m) ||
      /\bpremium\b/.test(m));
  return holdingsPlusWatchlist && wantsIdeas;
}

export const INCOME_IDEAS_RAG_QUERY =
  "conservative balanced aggressive wheel covered call cash secured put desk guidelines playbook income risk last 7 days";

export const INCOME_IDEAS_STATIC_GUIDELINES = `Desk posture guidelines (apply qualitatively to the user’s book; do not contradict workspace facts):
- **Conservative:** wider OTM, shorter gamma, prioritize capital preservation and liquidity; flag assignment/call-away explicitly.
- **Balanced:** modest OTM vs premium trade-off; one clear primary structure per name.
- **Aggressive:** tighter strikes / higher premium density only when liquidity and risk tolerance support it; still cite assignment risk.`;

const INCOME_IDEAS_JSON_SCHEMA = `Return **exactly one JSON object** (no markdown fences, no commentary, no citation chips) with this shape:
{
  "ideas": [
    {
      "ideaType": "covered_call" | "cash_secured_put" | "wheel" | "other",
      "underlying": string,
      "strike": number | null,
      "expiry": string | null,
      "premium": number | null,
      "assignmentRiskNote": string,
      "rationale": string
    }
  ],
  "disclaimer": "Not financial advice."
}
Rules: **exactly three** objects in \`ideas\` when the book/watchlist supports it; otherwise return fewer and explain gaps only inside each \`rationale\`. Use **null** for unknown numerics.`;

export function buildIncomeIdeasJsonOnlySuffix(): string {
  return [
    "**Income ideas mode (this turn only):**",
    "Think step-by-step internally, but **output only** the final JSON object — no prose before or after, no \\`\\`\\` fences.",
    INCOME_IDEAS_JSON_SCHEMA,
    "After internal reasoning, you may call **atx_function** / **yahoo_finance** / **options_scan** only if needed for realistic strikes, expiries, or premiums — still end with **only** the JSON object as your user-visible output.",
    "**Do not** emit xChat citation chips or markdown tables for this turn."
  ].join("\n");
}

export function buildIncomeIdeasUserSuffix(): string {
  return "Reminder: respond with **only** the JSON object defined in system instructions (three ideas when possible).";
}

/** Pull equity symbols for quote enrichment (bounded). */
export function collectIncomeIdeasEquitySymbols(preload: WorkspaceSnapshotPreload, max = 40): string[] {
  const set = new Set<string>();
  for (const row of preload.positionsFull) {
    if (normalizePositionType(row.positionType) !== "stock") {
      continue;
    }
    const sym = row.symbol.trim().toUpperCase();
    if (sym.length > 0) {
      set.add(sym);
    }
    if (set.size >= max) {
      break;
    }
  }
  return [...set];
}

export type IncomeIdeasCompactRow = {
  ticker: string;
  qty: number;
  avgCostUsd: number;
  costBasisUsd: number;
  currentValueUsd: number | null;
  dayChangePct: number | null;
  sector: string | null;
};

export type IncomeIdeasCompactPayload = {
  kind: "income_ideas_book_v1";
  loadedAt: string;
  workspaceContentRev: number;
  portfolioId: string;
  holdings: IncomeIdeasCompactRow[];
  watchlist: Array<{ ticker: string; spotUsd: number | null; strategy?: string; lineType?: string }>;
};

export function buildIncomeIdeasCompactPayload(
  preload: WorkspaceSnapshotPreload,
  quotes?: Map<string, SymbolLookupResult>
): IncomeIdeasCompactPayload {
  const j = preload.promptJson;
  const holdings: IncomeIdeasCompactRow[] = [];
  for (const row of preload.positionsFull) {
    if (normalizePositionType(row.positionType) !== "stock") {
      continue;
    }
    const ticker = row.symbol.trim().toUpperCase();
    const qty = row.qty;
    const avgCostUsd = row.avgCost;
    const costBasisUsd = Math.round(Math.abs(qty * avgCostUsd) * 100) / 100;
    const q = quotes?.get(row.symbol) ?? quotes?.get(ticker);
    const spot = typeof q?.price === "number" && Number.isFinite(q.price) ? q.price : null;
    const currentValueUsd =
      spot !== null ? Math.round(Math.abs(qty * spot) * 100) / 100 : null;
    let dayChangePct: number | null =
      typeof q?.changePercent === "number" && Number.isFinite(q.changePercent)
        ? Math.round(q.changePercent * 100) / 100
        : null;
    if (dayChangePct === null && spot !== null && avgCostUsd !== 0) {
      dayChangePct = Math.round(((spot - avgCostUsd) / Math.abs(avgCostUsd)) * 10000) / 100;
    }
    holdings.push({
      ticker,
      qty,
      avgCostUsd: Math.round(avgCostUsd * 10000) / 10000,
      costBasisUsd,
      currentValueUsd,
      dayChangePct,
      sector: null
    });
    if (holdings.length >= 48) {
      break;
    }
  }

  const wl = j.watchlist;
  const watchlist =
    "error" in wl
      ? []
      : wl.symbols.slice(0, 48).map((s) => {
          const ticker = String(s.symbol).trim().toUpperCase();
          const spotRaw = s.spotPriceDisplay?.replace(/[^0-9.-]/g, "") ?? "";
          const spotUsd = Number(spotRaw);
          return {
            ticker,
            spotUsd: Number.isFinite(spotUsd) ? spotUsd : null,
            ...(typeof s.strategy === "string" ? { strategy: s.strategy } : {}),
            ...(typeof s.lineType === "string" ? { lineType: s.lineType } : {})
          };
        });

  return {
    kind: "income_ideas_book_v1",
    loadedAt: j.loadedAt,
    workspaceContentRev: j.workspaceContentRev,
    portfolioId: j.portfolio.id,
    holdings,
    watchlist
  };
}

export function formatIncomeIdeasWorkspaceBlock(payload: IncomeIdeasCompactPayload): string {
  const json = JSON.stringify(payload);
  return [
    "Pre-summarized workspace book for income ideas (authoritative for tickers/qty/cost basis; refresh via tools if stale):",
    "```json",
    json,
    "```"
  ].join("\n");
}

/** Prefer recent-dated snippets; keep undated snippets as evergreen guidelines. */
export function filterRagSnippetsForIncomeIdeas(
  snippets: XaiCollectionSearchSnippet[],
  nowMs: number = Date.now(),
  maxKeep = 6
): XaiCollectionSearchSnippet[] {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const iso = /\b(20\d{2}-\d{2}-\d{2})\b/g;
  const picked: XaiCollectionSearchSnippet[] = [];
  for (const s of snippets) {
    const dates: number[] = [];
    let m: RegExpExecArray | null;
    const text = s.text;
    iso.lastIndex = 0;
    while ((m = iso.exec(text)) !== null) {
      const t = Date.parse(`${m[1]}T00:00:00.000Z`);
      if (!Number.isNaN(t)) {
        dates.push(t);
      }
    }
    if (dates.length === 0) {
      picked.push(s);
      continue;
    }
    const anyRecent = dates.some((t) => nowMs - t >= 0 && nowMs - t <= sevenDaysMs);
    if (anyRecent) {
      picked.push(s);
    }
  }
  return picked.slice(0, maxKeep);
}

export function mergeIncomeIdeasRagContext(filteredSnippets: XaiCollectionSearchSnippet[]): string {
  const ragLines =
    filteredSnippets.length > 0
      ? filteredSnippets
          .map((snippet, index) => {
            const source = snippet.documentName ?? snippet.documentId ?? "collection_doc";
            return `[#${index + 1}] (${source}) ${snippet.text}`;
          })
          .join("\n\n")
      : "";
  return [INCOME_IDEAS_STATIC_GUIDELINES, ragLines ? `Recent / evergreen KB excerpts:\n${ragLines}` : ""]
    .filter((x) => x.trim().length > 0)
    .join("\n\n");
}
