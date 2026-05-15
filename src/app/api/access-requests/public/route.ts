import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAccessRequestPlanInput } from "@/lib/access-request-plans";
import { DEFAULT_COUNTRY_CODE, parseCountryCode } from "@/lib/country-options";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { buildAccessRequestNotification, sendSlackNotification } from "@/lib/slack";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    AccessRequestDuplicatePendingError,
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";
import { setInitialPasswordFromPublicSignup } from "@/modules/identity/email-credentials-repository";
import { ensureCoreUserByEmail, updateCoreUserAccountStatus } from "@/modules/identity/repository";

/** Exported for unit tests (`tests/unit/access-requests-public-body-schema.test.ts`). */
export const guestAccessRequestSchema = z.object({
  /** Display handle for admins / audit; UI collects as "username" (letters + digits only). */
  name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9]+$/, "Username must contain only letters and numbers"),
  email: z.string().trim().email(),
  requestedPlan: z.string().trim().optional(),
  /** ISO 3166-1 alpha-2 country code (case-insensitive). Defaults to `US` server-side when omitted or unknown. */
  country: z.string().trim().min(2).max(8).optional(),
  /** Enables email/password login after access approval without a separate invite token. */
  password: z.string().min(12).max(128)
});

const ACCESS_REQUEST_PUBLIC_POLICY = getBffRouteRateLimitPolicy("access_requests_public_create");

function duplicateCoreUserIndexField(error: unknown): "username" | "email" | "x_user" | "google" | null {
  if (!(error instanceof MongoServerError) || error.code !== 11000) {
    return null;
  }
  const pattern = error.keyPattern;
  if (pattern && typeof pattern === "object") {
    if ("username" in pattern) {
      return "username";
    }
    if ("email" in pattern) {
      return "email";
    }
    if ("xAccount.xUserId" in pattern) {
      return "x_user";
    }
    if ("googleAccount.sub" in pattern) {
      return "google";
    }
  }
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("uniq_core_user_username")) {
    return "username";
  }
  if (msg.includes("uniq_core_user_email")) {
    return "email";
  }
  return null;
}

export async function POST(request: Request) {
  const limit = await checkDistributedRateLimit({
    key: `access-requests:public:${extractClientRateLimitKey(request)}`,
    windowMs: ACCESS_REQUEST_PUBLIC_POLICY.windowMs,
    max: ACCESS_REQUEST_PUBLIC_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Too many guest access requests. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = guestAccessRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const requestedPlan =
    parsed.data.requestedPlan === undefined
      ? "basic"
      : parseAccessRequestPlanInput(parsed.data.requestedPlan);
  if (!requestedPlan) {
    return NextResponse.json(
      { error: "Invalid requestedPlan. Expected Basic, Premium, or Premium+." },
      { status: 400 }
    );
  }
  const requestedRole = "operator" as const;

  const country = parseCountryCode(parsed.data.country) ?? DEFAULT_COUNTRY_CODE;

  let user: Awaited<ReturnType<typeof ensureCoreUserByEmail>>;
  try {
    user = await ensureCoreUserByEmail({ email, username: name, country });
  } catch (error) {
    const dup = duplicateCoreUserIndexField(error);
    if (dup === "username") {
      return NextResponse.json(
        {
          error: "That username is already taken. Choose a different username and try again.",
          code: "username_taken"
        },
        { status: 409 }
      );
    }
    if (dup === "email") {
      return NextResponse.json(
        { error: "That email is already registered.", code: "email_taken" },
        { status: 409 }
      );
    }
    if (dup === "x_user" || dup === "google") {
      return NextResponse.json(
        {
          error:
            "This email conflicts with an account that is linked to X or Google. Sign in with that provider or use a different email.",
          code: "identity_provider_conflict"
        },
        { status: 409 }
      );
    }
    console.error("[access-requests/public] ensureCoreUserByEmail failed", error);
    return NextResponse.json(
      { error: "Unable to complete registration. Please try again in a moment." },
      { status: 500 }
    );
  }

  if (!user._id) {
    return NextResponse.json({ error: "Unable to resolve user for access request" }, { status: 500 });
  }

  const pw = await setInitialPasswordFromPublicSignup({
    userId: user._id,
    plainPassword: parsed.data.password
  });
  if (!pw.ok) {
    if (pw.code === "already_has_password") {
      return NextResponse.json(
        { error: "This email already has a password. Sign in instead or use forgot password." },
        { status: 409 }
      );
    }
    if (pw.code === "not_found") {
      return NextResponse.json(
        {
          error:
            "We could not save your password for this account. Refresh and try again, or sign in if you already completed signup.",
          code: "account_not_found_after_provision"
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to save credentials for this account." }, { status: 500 });
  }

  const userId = user._id.toHexString();

  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId,
    requestedRole,
    tenantId: undefined
  });
  if (existingPending) {
    return NextResponse.json(
      {
        ok: true,
        data: {
          requestedRole: existingPending.requestedRole,
          requestedPlan: existingPending.requestedPlan,
          status: existingPending.status,
          requestedAt: existingPending.requestedAt.toISOString(),
          existing: true
        }
      },
      { status: 200 }
    );
  }

  await updateCoreUserAccountStatus({
    userId: user._id,
    accountStatus: "pending_approval"
  });

  let created;
  try {
    created = await createAccessRequest({
      userId,
      contactEmail: email,
      requestedRole,
      requestedPlan,
      reason: `Guest xChat registration from ${name}`,
      status: "pending"
    });
  } catch (error) {
    if (error instanceof AccessRequestDuplicatePendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (created._id) {
    await createAuditEvent({
      entityType: "access_request",
      entityId: created._id.toHexString(),
      action: "guest_self_requested",
      actor: {
        userId,
        email
      },
      details: {
        requestedRole: created.requestedRole,
        requestedPlan: created.requestedPlan,
        reason: created.reason,
        source: "xchat_guest_register",
        displayName: name
      }
    });
  }

  void sendSlackNotification(
    buildAccessRequestNotification({
      email,
      requestedRole,
      reason: `Guest xChat registration from ${name} (${requestedPlan})`
    })
  );

  return NextResponse.json(
    {
      ok: true,
      data: {
        requestedRole: created.requestedRole,
        requestedPlan: created.requestedPlan,
        status: created.status,
        requestedAt: created.requestedAt.toISOString()
      }
    },
    { status: 201 }
  );
}
