import { NextResponse } from "next/server";
import { z } from "zod";

import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { subscriberLandingPathForPlan } from "@/lib/default-landing-path";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { EmailPasswordSessionError, finalizeEmailPasswordSession } from "@/lib/finalize-email-password-session";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { completeCredentialInvite } from "@/modules/identity/email-credentials-repository";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import { getCoreUserById } from "@/modules/identity/repository";

const bodySchema = z.object({
  token: z.string().trim().min(20).max(512),
  password: z.string().min(10).max(128)
});

const POLICY = getBffRouteRateLimitPolicy("auth_email_complete_invite");

export async function POST(request: Request) {
  const limit = await checkDistributedRateLimit({
    key: `auth-email:complete-invite:${extractClientRateLimitKey(request)}`,
    windowMs: POLICY.windowMs,
    max: POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }

  const loginMeta = extractClientLoginMeta(request);
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

  const result = await completeCredentialInvite({
    rawToken: parsed.data.token,
    plainPassword: parsed.data.password
  });

  if (!result.ok) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "email_password",
      errorCode: `invite_${result.code}`,
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent
    });
    const status = result.code === "suspended" ? 403 : 400;
    return NextResponse.json({ error: result.code }, { status });
  }

  const user = await getCoreUserById(result.userId);
  if (!user?._id) {
    return NextResponse.json({ error: "user_missing" }, { status: 500 });
  }

  try {
    await finalizeEmailPasswordSession({ user, loginMeta });
  } catch (err) {
    const code = err instanceof EmailPasswordSessionError ? err.code : "no_tenant";
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "email_password",
      errorCode: `invite_session_${code}`,
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: user._id.toHexString(),
      email: user.email
    });
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const redirect = isGlobalAdmin(user.roles)
    ? "/admin"
    : subscriberLandingPathForPlan(user.subscriptionPlan);
  return NextResponse.json({ ok: true, redirect });
}
