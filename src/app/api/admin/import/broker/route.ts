import { NextResponse } from "next/server";
import { z } from "zod";

import { proxyRequestToBackend } from "@/lib/backend-bff";
import { requireAdminSession } from "@/lib/api-auth";
import { getPortfolioByIdForSessionUser, listPortfolioAccounts } from "@/modules/core-admin/repository";
import {
    applyBrokerHoldingsToMappedAccounts,
    parseBrokerHoldingsAccounts,
    previewBrokerHoldingsAccounts
} from "@/modules/portfolio-import/broker-holdings-import";

const bodySchema = z.object({
  portfolioId: z.string().trim().min(1),
  broker: z.enum(["merrill", "fidelity"]),
  exportType: z.enum(["holdings"]),
  csv: z.string().min(1),
  mappings: z.record(z.string(), z.string()).default({}),
  fidelityHoldingsDefaultAccountRef: z.string().optional(),
  dryRun: z.boolean().optional()
});

function isMappingsRecord(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== "object") return false;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");
}

/**
 * POST /api/admin/import/broker
 * Holdings-only broker CSV import aligned with xfinance-strategy POST /api/import/broker
 * (broker, exportType, csv, mappings) and OpenAPI Position fields (ticker, shares, purchasePrice, type).
 * Stock lots map to Mongo positions (symbol, qty, avgCost). Option/cash rows are skipped.
 */
export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) return proxied;

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { portfolioId, broker, exportType, csv, mappings, fidelityHoldingsDefaultAccountRef, dryRun } =
    parsed.data;
  if (!isMappingsRecord(mappings)) {
    return NextResponse.json({ error: "mappings must be string-to-string" }, { status: 400 });
  }

  const portfolio = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { accounts: parsedAccounts, parseError } = parseBrokerHoldingsAccounts(
    broker,
    csv,
    fidelityHoldingsDefaultAccountRef ?? ""
  );
  if (parseError || parsedAccounts.length === 0) {
    return NextResponse.json(
      { error: parseError ?? "No accounts parsed from CSV" },
      { status: 400 }
    );
  }

  const accountIdsUsed = [...new Set(Object.values(mappings).map((s) => s.trim()).filter(Boolean))];
  if (!dryRun && accountIdsUsed.length > 0) {
    const owned = await listPortfolioAccounts({
      userId: session.userId,
      portfolioId,
      tenantId: session.tenantId
    });
    const allowed = new Set(owned.map((a) => a._id?.toHexString()).filter(Boolean) as string[]);
    for (const id of accountIdsUsed) {
      if (!allowed.has(id)) {
        return NextResponse.json(
          { error: "One or more mapped accounts are not in this portfolio" },
          { status: 403 }
        );
      }
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      broker,
      exportType,
      accounts: previewBrokerHoldingsAccounts(parsedAccounts)
    });
  }

  const results = await applyBrokerHoldingsToMappedAccounts({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    parsedAccounts,
    mappings
  });

  return NextResponse.json({ results });
}
