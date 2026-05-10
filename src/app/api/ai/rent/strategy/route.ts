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
import {
    createCompletedRentalAiJob,
    getRentalAiJobForTenant
} from "@/modules/platform/rental-ai-jobs";

export const maxDuration = 45;

const symbolRe = /^[A-Za-z0-9._\-]{1,32}$/;

const bodySchema = z.object({
  symbols: z.array(z.string().regex(symbolRe)).min(1).max(64),
  portfolioId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  notes: z.string().max(8000).optional()
});

export async function GET(request: Request) {
  const correlationId = resolveCorrelationId(request);
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  const auth = await authenticateRentalAiApiKey(request.headers.get("authorization"), "strategy");
  if (!auth.ok) {
    return rentalAiJsonResponse(
      { error: auth.message, code: auth.code, correlationId },
      auth.status
    );
  }
  if (!jobId) {
    return rentalAiJsonResponse(
      { error: "jobId is required", code: "validation_error", correlationId },
      400
    );
  }
  const job = await getRentalAiJobForTenant({
    tenantId: auth.ctx.tenantId,
    jobId,
    scope: "strategy"
  });
  if (!job?._id) {
    return rentalAiJsonResponse({ error: "Job not found", code: "not_found", correlationId }, 404);
  }
  return rentalAiJsonResponse(
    {
      ok: true,
      correlationId,
      data: {
        jobId: job._id.toHexString(),
        status: job.status,
        scope: job.scope,
        result: job.result ?? null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString()
      }
    },
    200
  );
}

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

  const conc = await tryAcquireRentalAiConcurrencyOr429(tenantHex);
  if ("failure" in conc) {
    const headers = mergeRentalAiHeaders(base, conc.failure.response.headers);
    return new Response(conc.failure.response.body, {
      status: conc.failure.response.status,
      headers
    });
  }
  const { slot } = conc;

  try {
    const symbols = [...new Set(parsedBody.data.symbols.map((s) => s.toUpperCase()))];
    const jobId = await createCompletedRentalAiJob({
      tenantId: auth.ctx.tenantId,
      apiKeyId: auth.ctx.apiKeyId,
      scope: "strategy",
      request: {
        symbols,
        portfolioId: parsedBody.data.portfolioId,
        notes: parsedBody.data.notes
      },
      result: {
        strategyBias: auth.ctx.rentalProfile.strategyBias,
        symbols,
        portfolioId: parsedBody.data.portfolioId,
        message:
          "Strategy request accepted and materialized for polling. Tenant scope, API key scope, and guardrails were enforced."
      }
    });
    await logRentalAiAudit({
      ctx: auth.ctx,
      correlationId,
      action: "rental_ai_strategy_request",
      details: {
        symbolCount: parsedBody.data.symbols.length,
        portfolioId: parsedBody.data.portfolioId,
        jobId
      }
    });

    return rentalAiJsonResponse(
      {
        ok: true,
        correlationId,
        code: "accepted",
        data: {
          jobId,
          status: "accepted",
          pollUrl: `/api/ai/rent/strategy?jobId=${jobId}`
        }
      },
      202
    );
  } finally {
    await releaseRentalAiConcurrencySafe(tenantHex, slot);
  }
}
