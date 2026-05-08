import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import {
    classifyAlertSurface,
    extractCloseKindFromBody,
    parseContractKey,
    parseContractKeyFromBody,
    portfolioAlertRowScannerMetadata
} from "@/lib/portfolio-alert-desk-present";
import { respondWithXai } from "@/lib/xai";
import { adminGetPortfolioAlert } from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; alertId: string }>;
};

const SYSTEM = `You are a senior listed-options risk desk writer for approved professional users of aTx Advisor.
Write ONE short paragraph (3–5 sentences), plain English, confident tone.
Use ONLY facts present in the JSON payload (titles, bodies, numeric metrics). If a field is missing, do not invent broker fills, customer net worth, or regulatory status.
End with a single sentence that reminds the reader to verify live quotes and that this is not financial advice.
No markdown bullets; no numbered lists.`;

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, alertId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const alert = await adminGetPortfolioAlert(portfolioId, alertId);
  if (!alert?._id) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const meta = portfolioAlertRowScannerMetadata(alert.metadata);
  const ck = parseContractKeyFromBody(alert.body ?? null);
  const parsed = ck ? parseContractKey(ck) : null;
  const surface = classifyAlertSurface(alert.title, alert.body ?? null);
  const closeKind = extractCloseKindFromBody(alert.body ?? null);

  const payload = {
    surface,
    title: alert.title,
    body: alert.body ?? "",
    symbol: alert.symbol ?? null,
    accountName: alert.accountName ?? null,
    severity: alert.severity,
    closeKind,
    contract: parsed,
    metrics: meta?.metrics ?? null,
    thresholdsApplied: meta?.thresholdsApplied ?? null
  };

  try {
    const out = await respondWithXai({
      systemPrompt: SYSTEM,
      userPrompt: JSON.stringify(payload),
      tools: [],
      toolChoice: "none",
      maxTurns: 1
    });
    const text = out.outputText.trim().slice(0, 2800);
    return NextResponse.json({
      data: { narrative: text, model: out.model }
    });
  } catch (e) {
    console.warn("[portfolio/alerts/narrative] xAI failed", {
      portfolioIdPrefix: portfolioId.slice(0, 8),
      alertIdPrefix: alertId.slice(0, 8),
      message: e instanceof Error ? e.message : String(e)
    });
    return NextResponse.json(
      { error: "Desk narrative temporarily unavailable", code: "narrative_unavailable" },
      { status: 503 }
    );
  }
}
