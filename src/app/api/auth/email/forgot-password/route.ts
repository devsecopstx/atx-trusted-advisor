import { NextResponse } from "next/server";
import { z } from "zod";

import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { sendPasswordResetEmail } from "@/lib/send-email-credential-messages";
import { issuePasswordResetForUser } from "@/modules/identity/email-credentials-repository";
import { getCoreUserByEmail } from "@/modules/identity/repository";

const bodySchema = z.object({
  email: z.string().trim().email()
});

const POLICY = getBffRouteRateLimitPolicy("auth_email_forgot");

export async function POST(request: Request) {
  const limit = await checkDistributedRateLimit({
    key: `auth-email:forgot:${extractClientRateLimitKey(request)}`,
    windowMs: POLICY.windowMs,
    max: POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await getCoreUserByEmail(email);
  if (user?._id && user.passwordHash && user.passwordHash.length > 0) {
    const issued = await issuePasswordResetForUser(user._id);
    if (issued) {
      void sendPasswordResetEmail({
        request,
        to: user.email,
        rawToken: issued.rawToken
      });
    }
  }

  return NextResponse.json({ ok: true });
}
