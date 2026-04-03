import { getDb } from "@/lib/mongodb";
import type { ToolCallLog } from "@/lib/xai";
import { ensureXchatLogIndexes } from "@/modules/xchat/repository";
import type { XChatSessionLog } from "@/modules/xchat/types";
import { estimateHostedToolUsd, estimateUsdFromTokenUsage } from "@/modules/xchat/xai-model-pricing";

const COLLECTION = "xchat_tool_usage";
const CHAT_LOGS = "xchat_logs";

/** Hosted xAI tools we log with zero local duration (provider runs them). */
const HOSTED_TOOL_NAMES = new Set(["web_search", "x_search"]);

export type XchatToolUsageSource = "local_executor" | "hosted_placeholder";

export type XchatToolUsageDoc = {
  ts: Date;
  userId: string;
  personaId?: string;
  personaName?: string;
  requestId?: string;
  toolName: string;
  operation?: string;
  ok: boolean;
  errorMessage?: string;
  durationMs: number;
  source: XchatToolUsageSource;
};

/**
 * Maps xAI tool name + call args to an optional `operation` label for `xchat_tool_usage` analytics.
 * Wire name for the workspace tool is `atx_function` (legacy tests may use `atxfinance`).
 */
export function resolveXchatToolUsageOperation(
  toolName: string,
  args: Record<string, unknown>
): string | undefined {
  if (toolName === "yahoo_finance") {
    return "market_quote";
  }
  if (
    (toolName === "atx_function" || toolName === "atxfinance") &&
    typeof args.operation === "string"
  ) {
    return args.operation;
  }
  return undefined;
}

function classifySource(tc: ToolCallLog): XchatToolUsageSource {
  if (tc.durationMs === 0 && HOSTED_TOOL_NAMES.has(tc.name)) {
    return "hosted_placeholder";
  }
  return "local_executor";
}

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureToolUsageIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex({ ts: -1 });
  await col.createIndex({ userId: 1, ts: -1 });
  await col.createIndex({ toolName: 1, ts: -1 });
}

export async function ensureXchatToolUsageIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = ensureToolUsageIndexes().catch((e) => {
      ensureIndexesPromise = null;
      throw e;
    });
  }
  await ensureIndexesPromise;
}

function buildDocsFromToolCalls(input: {
  userId: string;
  personaId?: string;
  personaName?: string;
  requestId?: string;
  toolCalls: ToolCallLog[];
}): XchatToolUsageDoc[] {
  const ts = new Date();
  return input.toolCalls.map((tc) => ({
    ts,
    userId: input.userId,
    personaId: input.personaId,
    personaName: input.personaName,
    requestId: input.requestId,
    toolName: tc.name,
    operation: resolveXchatToolUsageOperation(tc.name, tc.args),
    ok: !tc.error,
    errorMessage: tc.error,
    durationMs: tc.durationMs,
    source: classifySource(tc)
  }));
}

/**
 * Persists tool usage for analytics (admin UI). Fire-and-forget from the ask route.
 */
export async function recordXchatToolUsageFromAsk(input: {
  userId: string;
  personaId?: string;
  personaName?: string;
  requestId?: string;
  toolCalls: ToolCallLog[];
}): Promise<void> {
  if (input.toolCalls.length === 0) {
    return;
  }
  await ensureXchatToolUsageIndexes();
  const db = await getDb();
  const docs = buildDocsFromToolCalls(input);
  await db.collection<XchatToolUsageDoc>(COLLECTION).insertMany(docs, { ordered: false });
}

/** Non-blocking wrapper — never throws to caller. */
export function fireAndForgetRecordXchatToolUsage(input: {
  userId: string;
  personaId?: string;
  personaName?: string;
  requestId?: string;
  toolCalls: ToolCallLog[];
}): void {
  if (input.toolCalls.length === 0) {
    return;
  }
  void recordXchatToolUsageFromAsk(input).catch((e) => {
    console.warn("[xchat/tool-usage] record failed", e instanceof Error ? e.message : e);
  });
}

export type AdminToolUsageByNameRow = {
  toolName: string;
  count: number;
  errors: number;
};

export type AdminToolUsageSummary = {
  windowDays: number;
  sinceIso: string;
  totalCalls: number;
  byTool: AdminToolUsageByNameRow[];
  recent: Array<{
    ts: string;
    userId: string;
    personaName?: string;
    toolName: string;
    operation?: string;
    ok: boolean;
    durationMs: number;
    source: XchatToolUsageSource;
  }>;
};

export type AdminXchatModelUsageRow = {
  model: string;
  turns: number;
  turnsWithUsage: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedPromptTokens: number;
  estimatedTokenUsd: number | null;
  pricingTierLabel: string | null;
};

/** xchat_logs aggregates + rough USD from public xAI token + hosted-tool rates (verify in console). */
export type AdminXchatModelCostSummary = {
  windowDays: number;
  sinceIso: string;
  totalChatTurns: number;
  turnsWithUsage: number;
  byModel: AdminXchatModelUsageRow[];
  estimatedTokenUsdTotal: number;
  estimatedHostedToolUsdTotal: number;
  estimatedGrandTotalUsd: number;
};

export async function getAdminXchatToolUsageSummary(options?: {
  windowDays?: number;
  recentLimit?: number;
}): Promise<AdminToolUsageSummary> {
  const windowDays = options?.windowDays ?? 7;
  const recentLimit = options?.recentLimit ?? 50;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  await ensureXchatToolUsageIndexes();
  const db = await getDb();
  const col = db.collection<XchatToolUsageDoc>(COLLECTION);

  const [agg, totalCalls, recentDocs] = await Promise.all([
    col
      .aggregate<{
        _id: string;
        count: number;
        errors: number;
      }>([
        { $match: { ts: { $gte: since } } },
        {
          $group: {
            _id: "$toolName",
            count: { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ["$ok", false] }, 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ])
      .toArray(),
    col.countDocuments({ ts: { $gte: since } }),
    col.find({ ts: { $gte: since } }).sort({ ts: -1 }).limit(recentLimit).toArray()
  ]);

  const byTool: AdminToolUsageByNameRow[] = agg.map((row) => ({
    toolName: row._id,
    count: row.count,
    errors: row.errors
  }));

  return {
    windowDays,
    sinceIso: since.toISOString(),
    totalCalls,
    byTool,
    recent: recentDocs.map((d) => ({
      ts: d.ts instanceof Date ? d.ts.toISOString() : String(d.ts),
      userId: d.userId,
      personaName: d.personaName,
      toolName: d.toolName,
      operation: d.operation,
      ok: d.ok,
      durationMs: d.durationMs,
      source: d.source
    }))
  };
}

type ModelAggDoc = {
  _id: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedPromptTokens: number;
  turnsWithUsage: number;
};

/**
 * Admin analytics: `/api/xchat/ask` turns in `xchat_logs` by `model`, optional `xaiUsage` token sums,
 * plus USD estimates from xAI-published model + hosted-tool pricing (approximate).
 */
export async function getAdminXchatModelCostSummary(input: {
  windowDays: number;
  sinceIso: string;
  byTool: AdminToolUsageByNameRow[];
}): Promise<AdminXchatModelCostSummary> {
  const windowDays = input.windowDays;
  const since = new Date(input.sinceIso);
  await ensureXchatLogIndexes();
  const db = await getDb();
  const col = db.collection<XChatSessionLog>(CHAT_LOGS);

  const [agg, totalChatTurns] = await Promise.all([
    col
      .aggregate<ModelAggDoc>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $ifNull: ["$model", "unknown"] },
            turns: { $sum: 1 },
            inputTokens: { $sum: { $ifNull: ["$xaiUsage.inputTokens", 0] } },
            outputTokens: { $sum: { $ifNull: ["$xaiUsage.outputTokens", 0] } },
            reasoningTokens: { $sum: { $ifNull: ["$xaiUsage.reasoningTokens", 0] } },
            cachedPromptTokens: { $sum: { $ifNull: ["$xaiUsage.cachedPromptTokens", 0] } },
            turnsWithUsage: {
              $sum: {
                $cond: [{ $gt: [{ $ifNull: ["$xaiUsage.totalTokens", 0] }, 0] }, 1, 0]
              }
            }
          }
        },
        { $sort: { turns: -1 } }
      ])
      .toArray(),
    col.countDocuments({ createdAt: { $gte: since } })
  ]);

  let estimatedTokenUsdTotal = 0;
  let turnsWithUsage = 0;
  const byModel: AdminXchatModelUsageRow[] = agg.map((row) => {
    turnsWithUsage += row.turnsWithUsage;
    const est = estimateUsdFromTokenUsage({
      model: row._id,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      reasoningTokens: row.reasoningTokens,
      cachedPromptTokens: row.cachedPromptTokens
    });
    if (est) {
      estimatedTokenUsdTotal += est.usd;
    }
    return {
      model: row._id,
      turns: row.turns,
      turnsWithUsage: row.turnsWithUsage,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      reasoningTokens: row.reasoningTokens,
      cachedPromptTokens: row.cachedPromptTokens,
      estimatedTokenUsd: est?.usd ?? null,
      pricingTierLabel: est?.pricingKey ?? null
    };
  });

  let estimatedHostedToolUsdTotal = 0;
  for (const t of input.byTool) {
    estimatedHostedToolUsdTotal += estimateHostedToolUsd(t.toolName, t.count);
  }

  return {
    windowDays,
    sinceIso: since.toISOString(),
    totalChatTurns,
    turnsWithUsage,
    byModel,
    estimatedTokenUsdTotal,
    estimatedHostedToolUsdTotal,
    estimatedGrandTotalUsd: estimatedTokenUsdTotal + estimatedHostedToolUsdTotal
  };
}
