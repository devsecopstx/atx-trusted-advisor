import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import { bumpPortfolioWorkspaceContentRev } from "@/modules/core-admin/repository";
import { normalizePositionType } from "@/modules/core-admin/types";
import { normalizeScannerSymbol } from "@/modules/scanner/phase3-scanner-shared";
import { fetchYahooOptionChainForScanner } from "@/modules/scanner/yahoo-option-chain-scanner";
import type { OptionContractData } from "@/modules/strategy-options/options-chain";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";

export const INVESTMENT_OUTLOOKS_COLLECTION = "investment_outlooks";

const POSITION_COLLECTION = "portfolio_positions";

export type StrikeOutlookPick = {
  strike: number;
  probabilityCalledAway?: number;
  probabilityExpireOtm?: number;
  premium?: number;
};

export type SymbolWheelOutlookRow = {
  symbol: string;
  spot: number;
  expirationYmd: string;
  coveredCall: {
    conservative: StrikeOutlookPick | null;
    aggressive: StrikeOutlookPick | null;
  };
  cashSecuredPut: {
    conservative: StrikeOutlookPick | null;
    aggressive: StrikeOutlookPick | null;
  };
};

/** Serialized for xChat workspace snapshot JSON (bounded symbol count). */
export type InvestmentOutlookPromptJson = {
  updatedAt: string;
  expiresAt: string;
  symbols: SymbolWheelOutlookRow[];
};

const MAX_OUTLOOK_SYMBOLS_IN_PROMPT = 24;

export async function loadInvestmentOutlookPromptJson(
  portfolioId: ObjectId
): Promise<InvestmentOutlookPromptJson | null> {
  const db = await getDb();
  const now = new Date();
  const doc = await db.collection<InvestmentOutlookDoc>(INVESTMENT_OUTLOOKS_COLLECTION).findOne(
    { portfolioId, expiresAt: { $gt: now } },
    { projection: { updatedAt: 1, expiresAt: 1, symbols: 1 } }
  );
  if (!doc?.symbols?.length) {
    return null;
  }
  const updatedAt =
    doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? "");
  const expiresAt =
    doc.expiresAt instanceof Date ? doc.expiresAt.toISOString() : String(doc.expiresAt ?? "");
  return {
    updatedAt,
    expiresAt,
    symbols: doc.symbols.slice(0, MAX_OUTLOOK_SYMBOLS_IN_PROMPT)
  };
}

async function bumpWorkspaceRevAfterOutlookChange(input: {
  portfolioUserId: unknown;
  portfolioId: ObjectId;
  tenantId: ObjectId;
}): Promise<void> {
  const uid =
    input.portfolioUserId != null ? String(input.portfolioUserId).trim() : "";
  if (!uid) {
    return;
  }
  await bumpPortfolioWorkspaceContentRev(
    {
      userId: uid,
      portfolioId: input.portfolioId.toHexString(),
      tenantId: input.tenantId.toHexString()
    },
    { skipInvestmentOutlookInvalidate: true }
  ).catch(() => {
    /* scanner context — non-fatal */
  });
}

export type InvestmentOutlookDoc = {
  _id?: ObjectId;
  portfolioId: ObjectId;
  tenantId: ObjectId;
  /** Portfolio owner — stored as string hex for consistency with `tenant_portfolio.userId`. */
  userId?: string;
  updatedAt: Date;
  expiresAt: Date;
  symbols: SymbolWheelOutlookRow[];
};

function strikePickFromCall(c: OptionContractData): StrikeOutlookPick {
  return {
    strike: c.strike_price,
    probabilityCalledAway: c.probability_called_away,
    premium: c.premium
  };
}

function strikePickFromPut(p: OptionContractData): StrikeOutlookPick {
  return {
    strike: p.strike_price,
    probabilityExpireOtm: p.probability_expire_otm,
    premium: p.premium
  };
}

/** Visible for tests — picks conservative (lower assignment / higher OTM) vs aggressive (near ATM) legs. */
export function pickWheelOutlookFromChain(
  chain: Array<{
    strike: number;
    call: OptionContractData | null;
    put: OptionContractData | null;
  }>,
  spot: number
): Omit<SymbolWheelOutlookRow, "symbol" | "spot" | "expirationYmd"> {
  const calls = chain
    .map((row) => ({ strike: row.strike, c: row.call }))
    .filter((x): x is { strike: number; c: OptionContractData } => x.c != null);

  const puts = chain
    .map((row) => ({ strike: row.strike, p: row.put }))
    .filter((x): x is { strike: number; p: OptionContractData } => x.p != null);

  let aggressiveCall: StrikeOutlookPick | null = null;
  let bestCallDist = Infinity;
  for (const { strike, c } of calls) {
    const d = Math.abs(strike - spot);
    if (d < bestCallDist) {
      bestCallDist = d;
      aggressiveCall = strikePickFromCall(c);
    }
  }

  let conservativeCall: StrikeOutlookPick | null = null;
  let bestCallAway = Infinity;
  const otmCalls = calls.filter((x) => x.strike >= spot * 1.02);
  for (const { c } of otmCalls) {
    const pAway = c.probability_called_away ?? 1;
    if (pAway < bestCallAway) {
      bestCallAway = pAway;
      conservativeCall = strikePickFromCall(c);
    }
  }
  if (!conservativeCall && aggressiveCall) {
    conservativeCall = aggressiveCall;
  }

  let aggressivePut: StrikeOutlookPick | null = null;
  let bestPutDist = Infinity;
  for (const { strike, p } of puts) {
    const d = Math.abs(strike - spot);
    if (d < bestPutDist) {
      bestPutDist = d;
      aggressivePut = strikePickFromPut(p);
    }
  }

  let conservativePut: StrikeOutlookPick | null = null;
  let bestPutOtm = -1;
  const otmPuts = puts.filter((x) => x.strike <= spot * 0.98);
  for (const { p } of otmPuts) {
    const po = p.probability_expire_otm ?? 0;
    if (po > bestPutOtm) {
      bestPutOtm = po;
      conservativePut = strikePickFromPut(p);
    }
  }
  if (!conservativePut && aggressivePut) {
    conservativePut = aggressivePut;
  }

  return {
    coveredCall: { conservative: conservativeCall, aggressive: aggressiveCall },
    cashSecuredPut: { conservative: conservativePut, aggressive: aggressivePut }
  };
}

function outlookTtlMs(): number {
  const h = Number.parseInt(process.env.INVESTMENT_OUTLOOK_TTL_HOURS ?? "36", 10);
  const hrs = Number.isFinite(h) && h >= 1 && h <= 168 ? h : 36;
  return hrs * 3600000;
}

function outlookChainDte(): number {
  const n = Number.parseInt(process.env.INVESTMENT_OUTLOOK_CHAIN_DTE ?? "28", 10);
  return Number.isFinite(n) && n >= 7 && n <= 120 ? n : 28;
}

let outlookIndexesEnsured = false;

async function ensureInvestmentOutlookIndexes(): Promise<void> {
  if (outlookIndexesEnsured) {
    return;
  }
  outlookIndexesEnsured = true;
  const db = await getDb();
  const coll = db.collection(INVESTMENT_OUTLOOKS_COLLECTION);
  try {
    await coll.createIndex({ portfolioId: 1 }, { unique: true, name: "uniq_investment_outlook_portfolio" });
    await coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_investment_outlook_expires" });
  } catch {
    /* non-fatal */
  }
}

export async function refreshInvestmentOutlooksForTenant(tenantId: ObjectId): Promise<void> {
  await ensureInvestmentOutlookIndexes();
  const db = await getDb();
  const coll = db.collection<InvestmentOutlookDoc>(INVESTMENT_OUTLOOKS_COLLECTION);

  const targetDte = outlookChainDte();
  const expiresAt = new Date(Date.now() + outlookTtlMs());
  const portfolios = await db
    .collection(TENANT_PORTFOLIO_COLLECTION)
    .find({ tenantId })
    .project({ _id: 1, userId: 1 })
    .toArray();

  for (const pf of portfolios) {
    const pid = pf._id as ObjectId;
    const rows = await db
      .collection(POSITION_COLLECTION)
      .find({
        tenantId,
        portfolioId: pid,
        qty: { $gt: 0 }
      })
      .project({ symbol: 1, type: 1, optionType: 1 })
      .limit(800)
      .toArray();

    const symbols = new Set<string>();
    for (const r of rows) {
      if (normalizePositionType(r.type) !== "stock") {
        continue;
      }
      const sym = normalizeScannerSymbol(r.symbol);
      if (sym) {
        symbols.add(sym);
      }
    }
    if (symbols.size === 0) {
      const del = await coll.deleteOne({ portfolioId: pid });
      if (del.deletedCount > 0) {
        await bumpWorkspaceRevAfterOutlookChange({
          portfolioUserId: pf.userId,
          portfolioId: pid,
          tenantId
        });
      }
      continue;
    }

    const symList = [...symbols].sort();
    const quotes = await getYahooBatchQuotes(symList);
    const quoteBySym = new Map<string, number>();
    for (const q of quotes) {
      const s = normalizeScannerSymbol(q.symbol);
      if (s && typeof q.price === "number" && Number.isFinite(q.price) && q.price > 0) {
        quoteBySym.set(s, q.price);
      }
    }

    const outlookRows: SymbolWheelOutlookRow[] = [];
    const expGuess = new Date();
    expGuess.setUTCDate(expGuess.getUTCDate() + targetDte);
    const expIso = expGuess.toISOString().slice(0, 10);

    for (const sym of symList) {
      const spot = quoteBySym.get(sym);
      if (spot === undefined) {
        continue;
      }
      const chainResult = await fetchYahooOptionChainForScanner(
        { tenantId },
        sym,
        expIso,
        spot,
        Math.max(1, targetDte)
      );
      if (!chainResult?.optionChain?.length) {
        continue;
      }
      const picks = pickWheelOutlookFromChain(chainResult.optionChain, spot);
      outlookRows.push({
        symbol: sym,
        spot,
        expirationYmd: chainResult.actualExpiration,
        coveredCall: picks.coveredCall,
        cashSecuredPut: picks.cashSecuredPut
      });
    }

    if (outlookRows.length === 0) {
      const del = await coll.deleteOne({ portfolioId: pid });
      if (del.deletedCount > 0) {
        await bumpWorkspaceRevAfterOutlookChange({
          portfolioUserId: pf.userId,
          portfolioId: pid,
          tenantId
        });
      }
      continue;
    }

    await coll.updateOne(
      { portfolioId: pid },
      {
        $set: {
          tenantId,
          userId: pf.userId != null ? String(pf.userId) : undefined,
          updatedAt: new Date(),
          expiresAt,
          symbols: outlookRows
        }
      },
      { upsert: true }
    );
    await bumpWorkspaceRevAfterOutlookChange({
      portfolioUserId: pf.userId,
      portfolioId: pid,
      tenantId
    });
  }
}
