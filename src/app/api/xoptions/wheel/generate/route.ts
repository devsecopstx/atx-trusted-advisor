import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { archiveAdvisorXoptionsAdviceIfRequired } from "@/modules/compliance/advisor-advice-events";
import { canUserLogin, isAdvisorPlatformRole, isGlobalAdmin } from "@/modules/identity/authorization";
import { generateWheelPayload } from "@/modules/xoptions/wheel-generator";
import { createWheelReport } from "@/modules/xoptions/wheel-report-repository";
import type { WheelGeneratorInput } from "@/modules/xoptions/wheel-types";

const wheelInputSchema = z.object({
  ticker: z.string().trim().min(1).max(16),
  availableCapitalUsd: z.number().positive().max(1_000_000_000),
  riskTolerance: z.enum(["conservative", "balanced", "aggressive"]),
  expirationCycle: z.enum(["weekly", "monthly", "quarterly"]),
  targetPutDelta: z.number().min(0.08).max(0.45),
  targetCallDelta: z.number().min(0.12).max(0.5),
  minimumPremiumYieldPerCyclePct: z.number().min(0).max(200),
  maxPositionSizePct: z.number().min(1).max(100),
  reentryRule: z.enum(["roll_immediately", "wait_pullback", "stagger_reentry"]),
  ivPercentileMin: z.number().min(0).max(100).nullable().optional(),
  avoidEarningsWeek: z.boolean(),
  sectorPreference: z.string().trim().max(100).nullable().optional(),
  taxConsideration: z.enum(["tax_deferred", "taxable", "mixed"]).nullable().optional(),
  variationCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  reportStyle: z.enum(["executive", "institutional"])
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = wheelInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid wheel generator payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data as WheelGeneratorInput;
  try {
    const generated = await generateWheelPayload(session, input);
    const persisted = await createWheelReport({
      userId: new ObjectId(session.userId),
      ...(ObjectId.isValid(session.tenantId) ? { tenantId: new ObjectId(session.tenantId) } : {}),
      userDisplayName: session.displayName?.trim() || session.username?.trim() || session.email,
      payload: generated
    });
    if (!isGlobalAdmin(session.roles) && isAdvisorPlatformRole(session.roles)) {
      archiveAdvisorXoptionsAdviceIfRequired({
        roles: session.roles,
        tenantId: session.tenantId,
        userId: session.userId,
        surface: "xoptions_wheel",
        artifactKind: "wheel_report",
        prompt: JSON.stringify(input),
        responsePayload: {
          reportId: persisted.reportId,
          report: generated
        },
        metadata: { reportStyle: input.reportStyle }
      });
    }

    return NextResponse.json({
      data: {
        reportId: persisted.reportId,
        generatedByName: persisted.generatedByName,
        createdAtIso: persisted.createdAtIso,
        report: generated
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate wheel report" },
      { status: 500 }
    );
  }
}
