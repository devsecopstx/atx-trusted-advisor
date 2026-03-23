import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { recommendationToJson } from "@/lib/recommendations-json";
import { canUserLogin } from "@/modules/identity/authorization";
import { getRecommendationForUser } from "@/modules/recommendations/repository";

type RouteContext = { params: Promise<{ recommendationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
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

  const { recommendationId } = await context.params;
  const doc = await getRecommendationForUser({
    id: recommendationId,
    userId: session.userId,
    tenantId: session.tenantId
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: recommendationToJson(doc) });
}
