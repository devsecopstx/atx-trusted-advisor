import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

/** Response header for support triage (matches common API convention). */
export const IBKR_CORRELATION_ID_HEADER = "X-Correlation-Id";

export function newIbkrCorrelationId(): string {
  return randomUUID();
}

export function ibkrJsonResponse(
  correlationId: string,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set(IBKR_CORRELATION_ID_HEADER, correlationId);
  return res;
}

export function attachIbkrCorrelationId(res: NextResponse, correlationId: string): NextResponse {
  res.headers.set(IBKR_CORRELATION_ID_HEADER, correlationId);
  return res;
}
