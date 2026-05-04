import { z } from "zod";

import { logRentalAiAudit } from "@/modules/platform/rental-ai-audit";
import { authenticateRentalAiApiKey } from "@/modules/platform/rental-ai-auth";
import {
    enforceRentalAiRateLimit,
    enforceRentalAiTokenBudget,
    releaseRentalAiConcurrencySafe,
    tryAcquireRentalAiConcurrencyOr429
} from "@/modules/platform/rental-ai-guardrails";
import {
    mergeRentalAiHeaders,
    rentalAiBaseHeaders,
    rentalAiJsonResponse,
    resolveCorrelationId
} from "@/modules/platform/rental-ai-http";

export const maxDuration = 45;

const symbolRe = /^[A-Za-z0-9._\-]{1,32}$/;

const bodySchema = z.object({
  symbols: z.array(z.string().regex(symbolRe)).min(1).max(64),
  portfolioId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  notes: z.string().max(8000).optional()
});

export async function POST(request: Request) {
  const correlationId = resolveCorrelationId(request);
  const base = rentalAiBaseHeaders();

  const auth = await authenticateRentalAiApiKey(request.headers.get("authorization"), "strategy");
  if (!auth.ok) {
    return rentalAiJsonResponse(
      { error: auth.message, code: auth.code, correlationId },
      auth.status
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return rentalAiJsonResponse({ error: "Invalid JSON", code: "invalid_json", correlationId }, 400);
  }

  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return rentalAiJsonResponse(
      {
        error: "Validation failed",
        code: "validation_error",
        correlationId,
        issues: parsedBody.error.flatten()
      },
      400
    );
  }

  const tenantHex = auth.ctx.tenantId.toHexString();

  const rl = await enforceRentalAiRateLimit(request, tenantHex, "strategy");
  if (rl) {
    const headers = mergeRentalAiHeaders(base, rl.response.headers);
    return new Response(rl.response.body, { status: rl.response.status, headers });
  }

  const budget = await enforceRentalAiTokenBudget({
    tenantIdHex: tenantHex,
    maxDailyTokens: auth.ctx.rentalProfile.maxDailyTokens,
    estimatedTokens: 8192
  });
  if (budget) {
    const headers = mergeRentalAiHeaders(base, budget.response.headers);
    return new Response(budget.response.body, { status: budget.response.status, headers });
  }

  const conc = tryAcquireRentalAiConcurrencyOr429(tenantHex);
  if (conc) {
    const headers = mergeRentalAiHeaders(base, conc.response.headers);
    return new Response(conc.response.body, { status: conc.response.status, headers });
  }

  try {
    await logRentalAiAudit({
      ctx: auth.ctx,
      correlationId,
      action: "rental_ai_strategy_request",
      details: {
        symbolCount: parsedBody.data.symbols.length,
        portfolioId: parsedBody.data.portfolioId
      }
    });

    return rentalAiJsonResponse(
      {
        ok: false,
        code: "rental_ai_not_implemented",
        correlationId,
        tenantSlug: auth.ctx.tenantSlug,
        strategyBias: auth.ctx.rentalProfile.strategyBias,
        message:
          "Rental strategy job bridge is not wired yet; auth and guardrails validated (bias available for downstream engine)."
      },
      501
    );
  } finally {
    releaseRentalAiConcurrencySafe(tenantHex);
  }
}
