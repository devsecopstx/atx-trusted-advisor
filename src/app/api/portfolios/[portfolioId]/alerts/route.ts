import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import {
    adminCreatePortfolioAlert,
    adminListPortfolioAlerts,
    deleteAllPortfolioAlertsForPortfolio,
    listPortfolioAccounts
} from "@/modules/core-admin/repository";
import type { PortfolioAlert } from "@/modules/core-admin/types";
import { dispatchPortfolioDeskEvents } from "@/modules/notifications/portfolio-notification-service";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializeAlert(a: PortfolioAlert) {
  return {
    _id: a._id!.toHexString(),
    title: a.title,
    body: a.body ?? null,
    severity: a.severity,
    status: a.status,
    symbol: a.symbol ?? null,
    portfolioId: a.portfolioId.toHexString(),
    portfolioName: a.portfolioName ?? null,
    accountId: a.accountId?.toHexString() ?? null,
    accountName: a.accountName ?? null,
    metadata: a.metadata ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

const objectIdHex = z.string().trim().regex(/^[a-f0-9]{24}$/i);

const postAppPortfolioAlertSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(4000).optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  symbol: z.string().trim().max(32).optional(),
  accountId: objectIdHex.optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(_request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const rows = await adminListPortfolioAlerts(portfolioId);
  return NextResponse.json({ data: rows.map(serializeAlert) });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postAppPortfolioAlertSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const accHex = parsed.data.accountId?.trim();
  if (accHex) {
    const accounts = await listPortfolioAccounts({
      userId: session.userId,
      portfolioId,
      tenantId: session.tenantId
    });
    const ok = accounts.some((a) => a._id?.toHexString().toLowerCase() === accHex.toLowerCase());
    if (!ok) {
      return NextResponse.json({ error: "Account not found in this portfolio" }, { status: 400 });
    }
  }

  const created = await adminCreatePortfolioAlert({
    portfolioId,
    title: parsed.data.title,
    body: parsed.data.body,
    severity: parsed.data.severity,
    status: "active",
    symbol: parsed.data.symbol,
    accountId: accHex
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Could not create alert" }, { status: 400 });
  }

  void dispatchPortfolioDeskEvents(portfolioId, [
    {
      title: created.title,
      body: created.body,
      symbol: created.symbol ?? undefined
    }
  ]).catch((err) => {
    console.warn("[portfolio/alerts] desk dispatch failed", {
      portfolioIdPrefix: portfolioId.slice(0, 8),
      error: err instanceof Error ? err.message : String(err)
    });
  });

  return NextResponse.json({ data: serializeAlert(created) }, { status: 201 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(_request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const deleted = await deleteAllPortfolioAlertsForPortfolio(portfolioId);
  return NextResponse.json({ deleted });
}
