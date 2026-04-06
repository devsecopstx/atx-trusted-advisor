import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import {
    listPortfolioPositionsByAccount,
    PositionValidationError,
    upsertPositionForAccount
} from "@/modules/core-admin/repository";
import {
    normalizePositionType,
    positionTypeValues,
    type PositionOptionType,
    type PositionType
} from "@/modules/core-admin/types";
import { ObjectId } from "mongodb";

function parseNumberLike(value: unknown): unknown {
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

function positiveNumberLike() {
  return z.preprocess(parseNumberLike, z.number().positive());
}

function nonNegativeNumberLike() {
  return z.preprocess(parseNumberLike, z.number().nonnegative());
}

function parseIsoDateAtUtcMidnight(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFutureIsoDate(value: string): boolean {
  const parsed = parseIsoDateAtUtcMidnight(value);
  if (!parsed) {
    return false;
  }
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return parsed.getTime() > todayUtc.getTime();
}

const upsertPositionSchema = z.object({
  portfolioId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  qty: z.number().positive(),
  avgCost: z.number().nonnegative(),
  type: z.enum(positionTypeValues).optional(),
  yahooRef: z.string().trim().max(160).optional(),
  optionType: z.enum(["call", "put"]).optional(),
  strike: positiveNumberLike().optional(),
  expiration: z.string().trim().min(1).optional()
});

const openApiPositionSchema = z.object({
  portfolioId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  type: z.enum(positionTypeValues).optional(),
  ticker: z.string().trim().min(1),
  yahooRef: z.string().trim().max(160).optional(),
  shares: positiveNumberLike().optional(),
  purchasePrice: nonNegativeNumberLike().optional(),
  contracts: positiveNumberLike().optional(),
  premium: nonNegativeNumberLike().optional(),
  amount: positiveNumberLike().optional(),
  optionType: z.enum(["call", "put"]).optional(),
  strike: nonNegativeNumberLike().optional(),
  expiration: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional()
});
type LegacyPositionInput = z.infer<typeof upsertPositionSchema>;
type OpenApiPositionInput = z.infer<typeof openApiPositionSchema>;

type NormalizedPositionUpsert = {
  portfolioId: string;
  accountId: string;
  symbol: string;
  qty: number;
  avgCost: number;
  type: PositionType;
  yahooRef?: string;
  optionType?: PositionOptionType;
  strike?: number;
  expiration?: Date;
};
const POSITIONS_LIST_POLICY = getBffRouteRateLimitPolicy("positions_list");
const POSITIONS_CREATE_POLICY = getBffRouteRateLimitPolicy("positions_create");

export async function GET(request: Request) {
  const limit = await checkDistributedRateLimit({
    key: `positions:list:${extractClientRateLimitKey(request)}`,
    windowMs: POSITIONS_LIST_POLICY.windowMs,
    max: POSITIONS_LIST_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Positions list rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const portfolioId = url.searchParams.get("portfolioId")?.trim() ?? "";
  const accountId = url.searchParams.get("accountId")?.trim() ?? "";

  if (!portfolioId || !accountId) {
    return NextResponse.json(
      { error: "Query parameters portfolioId and accountId are required" },
      { status: 400 }
    );
  }

  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  const positions = await listPortfolioPositionsByAccount({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountIds: [new ObjectId(accountId)]
  });

  return NextResponse.json({ data: positions });
}

export async function POST(request: Request) {
  const limit = await checkDistributedRateLimit({
    key: `positions:create:${extractClientRateLimitKey(request)}`,
    windowMs: POSITIONS_CREATE_POLICY.windowMs,
    max: POSITIONS_CREATE_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Positions create rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const payload = await request.json();
  const legacyParsed = upsertPositionSchema.safeParse(payload);
  const openApiParsed = legacyParsed.success ? null : openApiPositionSchema.safeParse(payload);
  if (!legacyParsed.success && (!openApiParsed || !openApiParsed.success)) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: {
          legacy: legacyParsed.error.flatten(),
          openapi: openApiParsed?.success ? undefined : openApiParsed?.error.flatten()
        }
      },
      { status: 400 }
    );
  }

  const normalized = normalizePositionPayload(
    legacyParsed.success ? legacyParsed.data : (openApiParsed!.data as OpenApiPositionInput)
  );
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const denied = await requireAccountInPortfolio(session, normalized.data.portfolioId, normalized.data.accountId);
  if (denied) {
    return denied;
  }

  try {
    const position = await upsertPositionForAccount({
      userId: session.userId,
      tenantId: session.tenantId,
      ...normalized.data
    });
    return NextResponse.json({ data: position }, { status: 201 });
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

function normalizePositionPayload(
  input: LegacyPositionInput | OpenApiPositionInput
): { ok: true; data: NormalizedPositionUpsert } | { ok: false; error: string } {
  if ("symbol" in input) {
    const t = normalizePositionType(input.type);
    const exp =
      input.expiration && t === "option" ? parseIsoDateAtUtcMidnight(input.expiration) : undefined;
    if (t === "option") {
      const yref = input.yahooRef?.trim();
      if (!yref) {
        const strikeOk =
          typeof input.strike === "number" && Number.isFinite(input.strike) && input.strike > 0;
        if (!exp || input.optionType === undefined || !strikeOk) {
          return {
            ok: false,
            error:
              "Option positions require yahooRef, or expiration + call/put + positive strike on legacy payload"
          };
        }
      }
    }
    return {
      ok: true,
      data: {
        portfolioId: input.portfolioId,
        accountId: input.accountId,
        symbol: input.symbol,
        qty: input.qty,
        avgCost: input.avgCost,
        type: t,
        yahooRef: input.yahooRef?.trim(),
        optionType: t === "option" ? input.optionType : undefined,
        strike: t === "option" && typeof input.strike === "number" ? input.strike : undefined,
        expiration: t === "option" ? (exp ?? undefined) : undefined
      }
    };
  }

  const symbol = input.ticker.trim().toUpperCase();
  if (!symbol) {
    return { ok: false, error: "ticker is required" };
  }

  const type = input.type ?? "stock";
  const shares = input.shares;
  const contracts = input.contracts;
  const amount = input.amount;
  const purchasePrice = input.purchasePrice;
  const premium = input.premium;
  const expiration = input.expiration?.trim();

  if (type === "cash") {
    const cashAmount =
      typeof amount === "number" && Number.isFinite(amount) && amount > 0
        ? amount
        : typeof shares === "number" && Number.isFinite(shares) && shares > 0
          ? shares
          : undefined;
    if (!cashAmount) {
      return { ok: false, error: "cash positions require amount or shares" };
    }
    return {
      ok: true,
      data: {
        portfolioId: input.portfolioId,
        accountId: input.accountId,
        symbol,
        qty: 1,
        avgCost: cashAmount,
        type: "cash" as const,
        yahooRef: undefined,
        optionType: undefined,
        strike: undefined,
        expiration: undefined
      }
    };
  }

  const qty =
    typeof shares === "number" && Number.isFinite(shares) && shares > 0
      ? shares
      : typeof contracts === "number" && Number.isFinite(contracts) && contracts > 0
        ? contracts
        : undefined;
  if (!qty) {
    return {
      ok: false,
      error: type === "option" ? "option positions require shares or contracts" : "shares is required"
    };
  }

  const avgCost =
    typeof purchasePrice === "number" && Number.isFinite(purchasePrice) && purchasePrice >= 0
      ? purchasePrice
      : typeof premium === "number" && Number.isFinite(premium) && premium >= 0
        ? premium
        : undefined;
  if (avgCost === undefined) {
    return { ok: false, error: "purchasePrice or premium is required" };
  }
  const yref = input.yahooRef?.trim();
  const expDate =
    type === "option" && expiration ? parseIsoDateAtUtcMidnight(expiration) : undefined;
  const strikeVal =
    type === "option" && typeof input.strike === "number" && Number.isFinite(input.strike)
      ? input.strike
      : undefined;

  if (type === "option") {
    if (yref) {
      // yahooRef is the canonical key; expiration may be absent or any valid calendar date for display
    } else {
      if (!expiration) {
        return { ok: false, error: "option positions require expiration when yahooRef is omitted" };
      }
      if (!isFutureIsoDate(expiration)) {
        return { ok: false, error: "option expiration must be a future date in YYYY-MM-DD format" };
      }
      if (!expDate || input.optionType === undefined || !strikeVal || strikeVal <= 0) {
        return {
          ok: false,
          error: "option positions require yahooRef or expiration + call/put + positive strike"
        };
      }
    }
  }

  return {
    ok: true,
    data: {
      portfolioId: input.portfolioId,
      accountId: input.accountId,
      symbol,
      qty,
      avgCost,
      type: type === "option" ? ("option" as const) : ("stock" as const),
      yahooRef: yref || undefined,
      optionType: type === "option" ? input.optionType : undefined,
      strike: type === "option" ? strikeVal : undefined,
      expiration: type === "option" ? (expDate ?? undefined) : undefined
    }
  };
}
