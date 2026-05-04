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

const bodySchema = z.object({
  message: z.string().min(1).max(32_000),
  portfolioId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  stream: z.boolean().optional()
});

export async function POST(request: Request) {
  const correlationId = resolveCorrelationId(request);
  const base = rentalAiBaseHeaders();

  const auth = await authenticateRentalAiApiKey(request.headers.get("authorization"), "chat");
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

  const rl = await enforceRentalAiRateLimit(request, tenantHex, "chat");
  if (rl) {
    const headers = mergeRentalAiHeaders(base, rl.response.headers);
    return new Response(rl.response.body, { status: rl.response.status, headers });
  }

  const budget = await enforceRentalAiTokenBudget({
    tenantIdHex: tenantHex,
    maxDailyTokens: auth.ctx.rentalProfile.maxDailyTokens
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
      action: "rental_ai_chat_request",
      details: {
        portfolioId: parsedBody.data.portfolioId,
        stream: parsedBody.data.stream ?? false
      }
    });

    return rentalAiJsonResponse(
      {
        ok: false,
        code: "rental_ai_not_implemented",
        correlationId,
        tenantSlug: auth.ctx.tenantSlug,
        message:
          "Rental xChat execution is not wired yet; API key, scopes, rate limits, and token budget were validated."
      },
      501
    );
  } finally {
    releaseRentalAiConcurrencySafe(tenantHex);
  }
}
