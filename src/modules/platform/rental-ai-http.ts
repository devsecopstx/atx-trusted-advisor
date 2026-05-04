import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export function resolveCorrelationId(request: Request): string {
  const h = request.headers.get("x-correlation-id")?.trim();
  if (h && h.length <= 128) {
    return h;
  }
  return randomUUID();
}

export function rentalAiBaseHeaders(): Headers {
  const h = new Headers();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "no-referrer");
  h.set("Cross-Origin-Resource-Policy", "same-site");
  return h;
}

export function mergeRentalAiHeaders(target: Headers, source?: Headers | HeadersInit): Headers {
  const out = new Headers(target);
  if (!source) {
    return out;
  }
  const src = source instanceof Headers ? source : new Headers(source);
  src.forEach((v, k) => {
    out.set(k, v);
  });
  return out;
}

export function rentalAiJsonResponse(
  body: Record<string, unknown>,
  status: number,
  extra?: HeadersInit
): NextResponse {
  const headers = mergeRentalAiHeaders(rentalAiBaseHeaders(), extra);
  headers.set("content-type", "application/json");
  return NextResponse.json(body, { status, headers });
}
