import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import {
    createOptionsScanSharedReport,
    type OptionsScanReportScanData
} from "@/modules/xchat/options-scan-share-repository";

const reportRowSchema = z.object({
  rowId: z.string().trim().min(1).max(160),
  source: z.enum(["holding", "watchlist"]),
  symbol: z.string().trim().min(1).max(32),
  strike: z.number().positive().optional(),
  exp: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["call", "put"]).optional(),
  qty: z.number().finite().optional(),
  recommendedAction: z.enum(["ROLL", "BTC", "HOLD", "LET_EXPIRE", "STC", "OPEN", "MONITOR", "WAIT"]),
  why: z.string().trim().min(1).max(500),
  urgency: z.enum(["high", "med", "low"]),
  targetWindow: z.string().trim().min(1).max(80),
  confidence: z.enum(["high", "medium", "low"]),
  applyToWatchlist: z.object({
    type: z.literal("apply_to_watchlist"),
    symbol: z.string().trim().min(1).max(32),
    allowPriceAlert: z.boolean(),
    defaultPriceAlertSeverity: z.literal("info")
  })
});

const createSharedReportSchema = z.object({
  scanData: z.object({
    generatedAt: z.string().datetime(),
    planTier: z.enum(["basic", "premium", "premium_plus", "global_admin"]),
    truncated: z.boolean(),
    rows: z.array(reportRowSchema).max(120),
    disclaimer: z.string().trim().min(1).max(1000)
  })
});

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
  const parsed = createSharedReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const scanData: OptionsScanReportScanData = parsed.data.scanData;
  const created = await createOptionsScanSharedReport({
    userId: new ObjectId(session.userId),
    ...(ObjectId.isValid(session.tenantId) ? { tenantId: new ObjectId(session.tenantId) } : {}),
    scanData
  });

  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/reports/scan/${created.shareToken}`;
  return NextResponse.json({
    data: {
      shareUrl,
      shareToken: created.shareToken,
      expiresAt: created.expiresAt.toISOString(),
      expiresIn: "24 hours"
    }
  });
}
