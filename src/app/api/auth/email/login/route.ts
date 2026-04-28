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
import { sendEmailVerificationEmail } from "@/lib/send-email-credential-messages";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import {
    issueEmailVerificationForUser,
    verifyUserPassword
} from "@/modules/identity/email-credentials-repository";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import { getCoreUserByEmail } from "@/modules/identity/repository";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
  /** Safe relative path after login. */
  next: z.string().trim().max(512).optional()
});

const POLICY = getBffRouteRateLimitPolicy("auth_email_login");

export async function POST(request: Request) {
  const limit = await checkDistributedRateLimit({
    key: `auth-email:login:${extractClientRateLimitKey(request)}`,
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

  const email = parsed.data.email.trim().toLowerCase();
  const user = await getCoreUserByEmail(email);
  const okPass =
    user &&
    user.passwordHash &&
    user.passwordHash.length > 0 &&
    (await verifyUserPassword(user, parsed.data.password));

  if (!okPass || !user?._id) {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "email_password",
      errorCode: "invalid_credentials",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      email
    });
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (!user.emailVerifiedAt && !isGlobalAdmin(user.roles)) {
    try {
      const issued = await issueEmailVerificationForUser(user._id);
      if (issued?.rawToken) {
        await sendEmailVerificationEmail({
          request,
          to: user.email,
          rawToken: issued.rawToken
        });
      }
    } catch {
      // Preserve deterministic auth response; verification delivery failures are non-fatal here.
    }
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "email_password",
      errorCode: "email_unverified",
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: user._id.toHexString(),
      email: user.email
    });
    return NextResponse.json({ error: "email_unverified" }, { status: 403 });
  }

  try {
    await finalizeEmailPasswordSession({ user, loginMeta });
  } catch (err) {
    const code = err instanceof EmailPasswordSessionError ? err.code : "no_tenant";
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "email_password",
      errorCode: `login_session_${code}`,
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      userId: user._id.toHexString(),
      email: user.email
    });
    return NextResponse.json({ error: code }, { status: 403 });
  }

  const nextRaw = parsed.data.next?.trim();
  const nextOk =
    nextRaw &&
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//") &&
    !nextRaw.includes("..") &&
    nextRaw.length <= 512;
  const fallback = isGlobalAdmin(user.roles)
    ? "/admin"
    : subscriberLandingPathForPlan(user.subscriptionPlan);
  const redirect = nextOk ? nextRaw! : fallback;
  return NextResponse.json({ ok: true, redirect });
}
