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

const bodySchema = z.object({
  jobId: z.string().min(8).max(128).optional(),
  deepRun: z.boolean().optional()
});

export async function GET(request: Request) {
  const correlationId = resolveCorrelationId(request);
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  const auth = await authenticateRentalAiApiKey(request.headers.get("authorization"), "analyze");
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
    scope: "analyze"
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

  const auth = await authenticateRentalAiApiKey(request.headers.get("authorization"), "analyze");
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

  const rl = await enforceRentalAiRateLimit(request, tenantHex, "analyze");
  if (rl) {
    const headers = mergeRentalAiHeaders(base, rl.response.headers);
    return new Response(rl.response.body, { status: rl.response.status, headers });
  }

  const budget = await enforceRentalAiTokenBudget({
    tenantIdHex: tenantHex,
    maxDailyTokens: auth.ctx.rentalProfile.maxDailyTokens,
    estimatedTokens: 16_384
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
    const jobId = await createCompletedRentalAiJob({
      tenantId: auth.ctx.tenantId,
      apiKeyId: auth.ctx.apiKeyId,
      scope: "analyze",
      request: {
        parentJobId: parsedBody.data.jobId,
        deepRun: parsedBody.data.deepRun ?? false
      },
      result: {
        parentJobId: parsedBody.data.jobId,
        deepRun: parsedBody.data.deepRun ?? false,
        strategyBias: auth.ctx.rentalProfile.strategyBias,
        message:
          "Analyze request accepted and materialized for polling under tenant scope."
      }
    });
    await logRentalAiAudit({
      ctx: auth.ctx,
      correlationId,
      action: "rental_ai_analyze_request",
      details: {
        jobId: parsedBody.data.jobId,
        deepRun: parsedBody.data.deepRun ?? false,
        analyzeJobId: jobId
      }
    });

    return rentalAiJsonResponse(
      {
        ok: true,
        code: "accepted",
        correlationId,
        data: {
          jobId,
          status: "accepted",
          pollUrl: `/api/ai/rent/analyze?jobId=${jobId}`
        }
      },
      202
    );
  } finally {
    releaseRentalAiConcurrencySafe(tenantHex);
  }
}
