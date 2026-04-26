import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { createWheelSharedReport } from "@/modules/xoptions/wheel-report-repository";

const ideaSchema = z.object({
  ideaId: z.string(),
  headline: z.string(),
  putLeg: z.object({
    strike: z.number(),
    expiration: z.string(),
    premium: z.number(),
    bid: z.number(),
    ask: z.number(),
    impliedVolatilityPct: z.number(),
    delta: z.number().nullable(),
    gamma: z.number().nullable(),
    thetaPerDay: z.number().nullable(),
    vegaPerOnePercentIv: z.number().nullable()
  }),
  callLeg: z.object({
    strike: z.number(),
    expiration: z.string(),
    premium: z.number(),
    bid: z.number(),
    ask: z.number(),
    impliedVolatilityPct: z.number(),
    delta: z.number().nullable(),
    gamma: z.number().nullable(),
    thetaPerDay: z.number().nullable(),
    vegaPerOnePercentIv: z.number().nullable()
  }),
  contracts: z.number(),
  requiredCapitalUsd: z.number(),
  premiumIncomePerCycleUsd: z.number(),
  annualizedYieldPct: z.number(),
  assignmentProbabilityPct: z.number(),
  callAwayProbabilityPct: z.number(),
  maxCapitalAtRiskUsd: z.number(),
  greeksSnapshot: z.object({
    delta: z.number(),
    gamma: z.number(),
    thetaPerDay: z.number(),
    vegaPerOnePercentIv: z.number()
  }),
  cycleBreakdown: z.array(z.string()),
  whyThisWorks: z.string()
});

const createWheelShareSchema = z.object({
  report: z.object({
    generatedAtIso: z.string().datetime(),
    input: z.object({
      ticker: z.string(),
      availableCapitalUsd: z.number(),
      riskTolerance: z.enum(["conservative", "balanced", "aggressive"]),
      expirationCycle: z.enum(["weekly", "monthly", "quarterly"]),
      targetPutDelta: z.number(),
      targetCallDelta: z.number(),
      minimumPremiumYieldPerCyclePct: z.number(),
      maxPositionSizePct: z.number(),
      reentryRule: z.enum(["roll_immediately", "wait_pullback", "stagger_reentry"]),
      ivPercentileMin: z.number().nullable().optional(),
      avoidEarningsWeek: z.boolean(),
      sectorPreference: z.string().nullable().optional(),
      taxConsideration: z.enum(["tax_deferred", "taxable", "mixed"]).nullable().optional(),
      variationCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
      reportStyle: z.enum(["executive", "institutional"])
    }),
    rootSnapshot: z.object({
      ticker: z.string(),
      spotPrice: z.number(),
      currency: z.string(),
      ivRankPercent: z.number().nullable(),
      earningsDateIso: z.string().nullable(),
      earningsWithin14Days: z.boolean(),
      sector: z.string().nullable()
    }),
    ideas: z.array(ideaSchema).min(1).max(5),
    portfolioFit: z.object({
      tickerAlreadyHeld: z.boolean(),
      currentHoldingMarketValueUsd: z.number(),
      projectedAllocationPct: z.number(),
      fitLabel: z.enum(["fits_policy", "concentrated", "over_limit"]),
      note: z.string()
    }),
    relatedSuppliers: z.object({
      rootTicker: z.string(),
      universeScanned: z.number().int().min(3).max(10),
      topCandidates: z
        .array(
          z.object({
            symbol: z.string(),
            companyName: z.string(),
            relationship: z.string(),
            spotPrice: z.number(),
            avgImpliedVolatilityPct: z.number(),
            estimatedWheelYieldPct: z.number(),
            momentum30dPct: z.number(),
            score: z.number(),
            rationale: z.string()
          })
        )
        .min(3)
        .max(3),
      selectionRule: z.string()
    }),
    executiveSummary: z.string(),
    monitoringRules: z.array(z.string()),
    disclaimer: z.string()
  })
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = createWheelShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid wheel report payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createWheelSharedReport({
    reportPayload: parsed.data.report,
    generatedByUserId: new ObjectId(session.userId),
    generatedByName: session.displayName?.trim() || session.username?.trim() || session.email,
    ...(ObjectId.isValid(session.tenantId) ? { tenantId: new ObjectId(session.tenantId) } : {})
  });
  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/reports/wheel/${created.shareToken}`;
  return NextResponse.json({
    data: {
      shareUrl,
      shareToken: created.shareToken,
      expiresAt: created.expiresAt.toISOString(),
      expiresIn: "24 hours"
    }
  });
}
