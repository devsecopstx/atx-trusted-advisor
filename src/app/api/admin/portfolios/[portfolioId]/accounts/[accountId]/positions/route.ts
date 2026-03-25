import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
    adminListPositionsForPortfolioAccount,
    adminUpsertPositionForPortfolioAccount,
    PositionValidationError
} from "@/modules/core-admin/repository";
import type { Position } from "@/modules/core-admin/types";
import {
    formatPositionUsd,
    normalizePositionType,
    positionExpirationUtcFromIsoDate,
    positionOptionTypeValues,
    positionTypeValues
} from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; accountId: string }>;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

function serializePosition(p: Position) {
  const t = normalizePositionType(p.type);
  const base = {
    _id: p._id!.toHexString(),
    type: t,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString()
  };
  if (t === "stock") {
    return {
      ...base,
      symbol: p.symbol,
      shares: p.qty,
      purchasePrice: p.avgCost
    };
  }
  if (t === "cash") {
    return {
      ...base,
      label: p.symbol,
      amount: p.avgCost,
      amountFormatted: formatPositionUsd(p.avgCost)
    };
  }
  const exp = p.expiration;
  return {
    ...base,
    symbol: p.symbol,
    yahooRef: p.yahooRef ?? "",
    optionType: p.optionType ?? null,
    strike: p.strike ?? null,
    expiration: exp ? exp.toISOString().slice(0, 10) : null,
    contracts: p.qty,
    premiumPerContract: p.avgCost
  };
}

const stockPost = z.object({
  type: z.literal("stock"),
  symbol: z.string().trim().min(1).max(32),
  shares: z.number().positive(),
  purchasePrice: z.number().nonnegative()
});

const optionPost = z.object({
  type: z.literal("option"),
  symbol: z.string().trim().min(1).max(32),
  yahooRef: z.string().trim().min(1).max(160),
  optionType: z.enum(positionOptionTypeValues),
  strike: z.number().positive(),
  expiration: isoDate,
  contracts: z.number().positive(),
  premiumPerContract: z.number().nonnegative()
});

const cashPost = z.object({
  type: z.literal("cash"),
  amount: z.number().nonnegative(),
  label: z.string().trim().max(32).optional()
});

/** Detailed shapes (preferred). */
const detailedPost = z.discriminatedUnion("type", [stockPost, optionPost, cashPost]);

/** Legacy compact body (stock / cash only). */
const legacyPost = z.object({
  type: z.enum(positionTypeValues).default("stock"),
  symbol: z.string().trim().min(1).max(32),
  qty: z.number().positive(),
  avgCost: z.number().nonnegative()
});

const postSchema = z.union([detailedPost, legacyPost]);

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;
  const bundle = await adminListPositionsForPortfolioAccount({ portfolioId, accountId });
  if (!bundle) {
    return NextResponse.json({ error: "Portfolio or account not found" }, { status: 404 });
  }

  const { portfolio, account, positions } = bundle;
  return NextResponse.json({
    data: {
      portfolioId: portfolio._id!.toHexString(),
      portfolioName: portfolio.name,
      portfolioUserId: normalizeMongoUserIdHex(portfolio.userId) ?? "",
      account: {
        _id: account._id!.toHexString(),
        name: account.name,
        extAccountId: account.extAccountId,
        type: account.type,
        isDefault: account.isDefault
      },
      positions: positions.map(serializePosition)
    }
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  let payload: Parameters<typeof adminUpsertPositionForPortfolioAccount>[0];

  if ("contracts" in data) {
    const expDate = positionExpirationUtcFromIsoDate(data.expiration);
    if (!expDate) {
      return NextResponse.json({ error: "Invalid expiration date" }, { status: 400 });
    }
    payload = {
      portfolioId,
      accountId,
      type: "option",
      symbol: data.symbol.toUpperCase(),
      qty: data.contracts,
      avgCost: data.premiumPerContract,
      yahooRef: data.yahooRef,
      optionType: data.optionType,
      strike: data.strike,
      expiration: expDate
    };
  } else if ("purchasePrice" in data) {
    payload = {
      portfolioId,
      accountId,
      type: "stock",
      symbol: data.symbol.toUpperCase(),
      qty: data.shares,
      avgCost: data.purchasePrice
    };
  } else if ("amount" in data) {
    const label = data.label?.trim() ? data.label.trim().toUpperCase() : "CASH";
    payload = {
      portfolioId,
      accountId,
      type: "cash",
      symbol: label,
      qty: 1,
      avgCost: data.amount
    };
  } else {
    if (data.type === "option") {
      return NextResponse.json(
        { error: "Option positions require the detailed payload (yahooRef, strike, expiration, …)" },
        { status: 400 }
      );
    }
    payload = {
      portfolioId,
      accountId,
      type: data.type,
      symbol: data.type === "cash" ? (data.symbol.trim() || "CASH").toUpperCase() : data.symbol.toUpperCase(),
      qty: data.qty,
      avgCost: data.avgCost
    };
  }

  try {
    const position = await adminUpsertPositionForPortfolioAccount(payload);
    return NextResponse.json({ data: serializePosition(position) }, { status: 201 });
  } catch (error) {
    if (error instanceof PositionValidationError) {
      const status =
        error.code === "ACCOUNT_NOT_FOUND" || error.code === "ACCOUNT_PORTFOLIO_MISMATCH"
          ? 404
          : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
