import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { publishRecommendationEvent } from "@/lib/pubsub/recommendations-publish";
import { recommendationToJson } from "@/lib/recommendations-json";
import { canUserLogin } from "@/modules/identity/authorization";
import {
    createRecommendation,
    listRecommendationsForUser
} from "@/modules/recommendations/repository";
import { recommendationStatusValues } from "@/modules/recommendations/types";

const createBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  summary: z.string().trim().max(4000).optional(),
  scopeTags: z.array(z.string().trim().max(128)).max(32).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(recommendationStatusValues).optional()
});
const RECOMMENDATIONS_LIST_POLICY = getBffRouteRateLimitPolicy("recommendations_list");
const RECOMMENDATIONS_CREATE_POLICY = getBffRouteRateLimitPolicy("recommendations_create");

export async function GET(request: Request) {
  const listLimit = await checkDistributedRateLimit({
    key: `recommendations:list:${extractClientRateLimitKey(request)}`,
    windowMs: RECOMMENDATIONS_LIST_POLICY.windowMs,
    max: RECOMMENDATIONS_LIST_POLICY.max
  });
  if (!listLimit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Recommendations list rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: listLimit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(listLimit) }
    );
  }
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await listRecommendationsForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    limit: 50
  });

  return NextResponse.json({
    data: items.map(recommendationToJson)
  });
}

export async function POST(request: Request) {
  const createLimit = await checkDistributedRateLimit({
    key: `recommendations:create:${extractClientRateLimitKey(request)}`,
    windowMs: RECOMMENDATIONS_CREATE_POLICY.windowMs,
    max: RECOMMENDATIONS_CREATE_POLICY.max
  });
  if (!createLimit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Recommendations create rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: createLimit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(createLimit) }
    );
  }
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createRecommendation({
    tenantId: session.tenantId,
    userId: session.userId,
    title: parsed.data.title,
    summary: parsed.data.summary,
    scopeTags: parsed.data.scopeTags,
    payload: parsed.data.payload,
    status: parsed.data.status,
    source: "user"
  });

  const id = created._id?.toHexString();
  if (id) {
    await publishRecommendationEvent({
      event: "created",
      recommendationId: id,
      userId: session.userId,
      tenantId: session.tenantId,
      status: created.status,
      occurredAt: created.createdAt.toISOString(),
      scopeTags: created.scopeTags,
      correlationId: request.headers.get("x-correlation-id")?.trim() || undefined
    });
  }

  return NextResponse.json({ data: recommendationToJson(created) }, { status: 201 });
}
