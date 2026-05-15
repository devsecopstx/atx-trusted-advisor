import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import { parseAccessRequestPlanInput } from "@/lib/access-request-plans";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminAccessRequestsRequestToBackend } from "@/lib/backend-bff";
import { consumeLastDeskSmtpSendError, explainDeskSmtpConfigBlock, getDeskSmtpConfig } from "@/lib/desk-smtp";
import { getEnv } from "@/lib/env";
import {
    sendAccessApprovedPasswordInviteEmail,
    sendAccessApprovedSignInEmail
} from "@/lib/send-email-credential-messages";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import { createAuditEvent, listAuditEventsForEntity } from "@/modules/audit/repository";
import { enqueueAccessRequestBootstrap } from "@/modules/core-admin/access-request-bootstrap";
import {
    deleteAccessRequest,
    getAccessRequestById,
    reviewAccessRequestById,
    updateAccessRequestPlanById,
    updateAccessRequestRoleById,
    updateAccessRequestTenantById
} from "@/modules/core-admin/repository";
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
import {
    ACTIONABLE_ACCESS_REQUEST_STATUSES,
    type AccessRequest
} from "@/modules/core-admin/types";
import { issueCredentialInviteForUser } from "@/modules/identity/email-credentials-repository";
import {
    addRoleToCoreUser,
    assertCanAddUserToTenant,
    getCoreUserById,
    getTenantByHexId,
    updateCoreUserAccountStatus,
    updateCoreUserSubscriptionPlan,
    upsertTenantMembership
} from "@/modules/identity/repository";
import { isTenantMembershipCapExceededError } from "@/modules/identity/tenant-membership-cap";
import { tenantBootstrapOnApprove } from "@/modules/platform/tenant-bootstrap-policy";

const accessRequestRoleSchema = z.enum(["global_admin", "advisor", "operator", "viewer"]);

const reviewAccessRequestSchema = z
  .object({
    status: z.enum(["approved", "rejected"]).optional(),
    requestedPlan: z.string().trim().optional(),
    requestedRole: accessRequestRoleSchema.optional(),
    /** 24-char tenant id, or empty string to clear (cannot approve without a tenant in the same request). */
    targetTenantId: z.string().optional(),
    /** Optional note stored on the request and audit trail when approving or rejecting. */
    reviewNote: z.string().max(2000).optional()
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.requestedPlan !== undefined ||
      value.requestedRole !== undefined ||
      value.targetTenantId !== undefined,
    { message: "Provide status, requestedPlan, requestedRole, and/or targetTenantId (reviewNote alone is not allowed)." }
  );

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

/** Included in PATCH/PUT approve responses so admins see why mail may be missing (e.g. local SMTP off). */
type AccessRequestApprovalEmailMeta = {
  deskSmtpConfigured: boolean;
  sent: boolean;
  channel?: "credential_invite" | "sign_in_reminder";
  skipped?: true;
  skipReason?: "no_user" | "no_deliverable_email";
  failed?: true;
  failureReason?: "smtp_not_configured" | "smtp_send_failed";
  /** Populated when `deskSmtpConfigured` is false — why env did not load (no secrets). */
  configHint?: string;
  /** Populated when SMTP was configured but `sendMail` threw (truncated). */
  sendErrorHint?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return handleUpdate(request, context);
}

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { requestId } = await context.params;
  const existing = await getAccessRequestById(requestId, {
    tenantId: undefined
  });
  if (!existing) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  const auditTrail = await listAuditEventsForEntity({
    entityType: "access_request",
    entityId: requestId
  });

  return NextResponse.json({
    data: {
      ...serializeAccessRequest(existing),
      auditTrail: auditTrail.map(serializeAuditEvent)
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return handleUpdate(request, context);
}

async function handleUpdate(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { requestId } = await context.params;
  const body = await request.json();
  const parsed = reviewAccessRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const requestedPlan =
    parsed.data.requestedPlan !== undefined ? parseAccessRequestPlanInput(parsed.data.requestedPlan) : undefined;
  if (parsed.data.requestedPlan !== undefined && !requestedPlan) {
    return NextResponse.json(
      { error: "Invalid requestedPlan. Expected Basic, Premium, or Premium+." },
      { status: 400 }
    );
  }

  let existing = await getAccessRequestById(requestId, {
    tenantId: undefined
  });
  if (!existing?._id) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  if (!ACTIONABLE_ACCESS_REQUEST_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: "Access request already reviewed", data: existing },
      { status: 409 }
    );
  }

  if (requestedPlan) {
    const updatedRequest = await updateAccessRequestPlanById({
      requestId,
      requestedPlan,
      tenantId: undefined
    });
    if (!updatedRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
    await createAuditEvent({
      entityType: "access_request",
      entityId: requestId,
      action: "updated_plan",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        requestedPlan
      }
    });
    const refetched = await getAccessRequestById(requestId, { tenantId: undefined });
    if (refetched) {
      existing = refetched;
    }
  }

  if (parsed.data.targetTenantId !== undefined) {
    const raw = parsed.data.targetTenantId.trim();
    const tenantIdHex = raw === "" ? null : raw;
    if (tenantIdHex !== null && !ObjectId.isValid(tenantIdHex)) {
      return NextResponse.json({ error: "Invalid targetTenantId" }, { status: 400 });
    }
    const updatedTenantRow = await updateAccessRequestTenantById({
      requestId,
      tenantIdHex,
      tenantId: undefined
    });
    if (!updatedTenantRow) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
    await createAuditEvent({
      entityType: "access_request",
      entityId: requestId,
      action: "assigned_tenant",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: { targetTenantId: tenantIdHex }
    });
    const refetchedTenant = await getAccessRequestById(requestId, { tenantId: undefined });
    if (refetchedTenant) {
      existing = refetchedTenant;
    }
  }

  if (parsed.data.requestedRole !== undefined) {
    const updatedRoleRow = await updateAccessRequestRoleById({
      requestId,
      requestedRole: parsed.data.requestedRole,
      tenantId: undefined
    });
    if (!updatedRoleRow) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
    await createAuditEvent({
      entityType: "access_request",
      entityId: requestId,
      action: "updated_role",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        requestedRole: parsed.data.requestedRole
      }
    });
    const refetchedRole = await getAccessRequestById(requestId, { tenantId: undefined });
    if (refetchedRole) {
      existing = refetchedRole;
    }
  }

  if (!parsed.data.status) {
    return NextResponse.json({ data: serializeAccessRequest(existing) });
  }

  const effectivePlan = normalizeSubscriptionPlan(
    requestedPlan ?? existing.requestedPlan ?? "basic"
  );
  let approvedUserObjectId: ObjectId | null = null;
  /** Applicant's book tenant (not the approving admin's session tenant). */
  let applicantPortfolioTenantId: string | undefined;

  if (parsed.data.status === "approved") {
    if (!existing.tenantId) {
      return NextResponse.json(
        {
          error:
            "Target tenant is required before approval. Select a tenant (or send targetTenantId in this request), then approve.",
          code: "access_request_tenant_required"
        },
        { status: 400 }
      );
    }
    if (!ObjectId.isValid(existing.userId)) {
      return NextResponse.json(
        { error: "Approved request has invalid user id" },
        { status: 400 }
      );
    }
    const userId = new ObjectId(existing.userId);
    approvedUserObjectId = userId;
    try {
      await assertCanAddUserToTenant({
        userId,
        tenantId: existing.tenantId!
      });
    } catch (e) {
      if (isTenantMembershipCapExceededError(e)) {
        return NextResponse.json(
          { error: e.message, code: e.code },
          { status: 409 }
        );
      }
      throw e;
    }
    try {
      await addRoleToCoreUser({
        userId,
        role: existing.requestedRole
      });
      await updateCoreUserSubscriptionPlan({
        userId,
        subscriptionPlan: effectivePlan
      });
      applicantPortfolioTenantId = existing.tenantId.toHexString();
      await upsertTenantMembership({
        userId,
        tenantId: existing.tenantId,
        role: "member",
        isDefaultTenant: true
      });
      await updateCoreUserAccountStatus({
        userId,
        accountStatus: "approved"
      });
    } catch (error) {
      if (isTenantMembershipCapExceededError(error)) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "Failed to apply approval grants",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }
    try {
      const tenantRow = await getTenantByHexId(applicantPortfolioTenantId);
      const eager = tenantBootstrapOnApprove(tenantRow?.tenantPreferences ?? null);
      if (eager) {
        /** Best-effort default book provisioning when tenant opts into approve-time bootstrap. */
        try {
          await ensureTenantBootstrapForUser({
            userId: existing.userId,
            tenantId: applicantPortfolioTenantId,
            trigger: "access_request_approve"
          });
        } catch (error) {
          console.error("[access-request/approve] tenant bootstrap failed", error);
          try {
            await createAuditEvent({
              entityType: "access_request",
              entityId: requestId,
              action: "default_portfolio_provision_failed",
              actor: {
                userId: session.userId,
                email: session.email,
                username: session.username
              },
              details: {
                userId: existing.userId,
                reason: error instanceof Error ? error.message.slice(0, 500) : "unknown"
              }
            });
          } catch {
            /* empty */
          }
        }
      }
    } catch (error) {
      console.error("[access-request/approve] tenant policy lookup failed", error);
    }
  }

  if (
    parsed.data.status === "rejected" &&
    ObjectId.isValid(existing.userId)
  ) {
    const uid = new ObjectId(existing.userId);
    const applicant = await getCoreUserById(uid);
    if (applicant?.accountStatus === "pending_approval") {
      await updateCoreUserAccountStatus({
        userId: uid,
        accountStatus: "rejected"
      });
    }
  }

  const reviewed = await reviewAccessRequestById({
    requestId,
    status: parsed.data.status,
    reviewedBy: session.userId,
    tenantId: undefined,
    reviewNote: parsed.data.reviewNote
  });

  if (!reviewed) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "access_request",
    entityId: requestId,
    action: parsed.data.status === "approved" ? "approved" : "rejected",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      requestedPlan: effectivePlan,
      ...(parsed.data.reviewNote !== undefined && parsed.data.reviewNote.trim()
        ? { reviewNote: parsed.data.reviewNote.trim().slice(0, 500) }
        : {})
    }
  });

  let approvalEmailMeta: AccessRequestApprovalEmailMeta | undefined;

  if (parsed.data.status === "approved") {
    const approvedUser = approvedUserObjectId
      ? await getCoreUserById(approvedUserObjectId)
      : null;
    const notifyEmail =
      approvedUser != null ? resolveAccessApprovalNotifyEmail(approvedUser, existing) : null;

    if (!approvedUser?._id) {
      approvalEmailMeta = {
        deskSmtpConfigured: getDeskSmtpConfig() !== null,
        sent: false,
        skipped: true,
        skipReason: "no_user"
      };
      await createAuditEvent({
        entityType: "access_request",
        entityId: requestId,
        action: "alert-user-not-sync-warning",
        actor: {
          userId: session.userId,
          email: session.email,
          username: session.username
        },
        details: {
          reason: "approved_user_row_missing",
          userId: existing.userId
        }
      });
    } else if (!notifyEmail) {
      approvalEmailMeta = {
        deskSmtpConfigured: getDeskSmtpConfig() !== null,
        sent: false,
        skipped: true,
        skipReason: "no_deliverable_email"
      };
      await createAuditEvent({
        entityType: "access_request",
        entityId: requestId,
        action: "alert-user-not-sync-warning",
        actor: {
          userId: session.userId,
          email: session.email,
          username: session.username
        },
        details: {
          reason: "no_deliverable_email_skipped_notifications",
          userId: existing.userId,
          coreEmailPlaceholder: Boolean(
            approvedUser.email && isXIdentityPlaceholderEmail(approvedUser.email)
          ),
          hadContactEmailOnRequest: Boolean(existing.contactEmail?.trim())
        }
      });
    } else {
      const deskSmtpConfigured = getDeskSmtpConfig() !== null;
      let sent = false;
      let channel: "credential_invite" | "sign_in_reminder" | undefined;
      const display =
        approvedUser.googleAccount?.displayName?.trim() ||
        approvedUser.xAccount?.displayName?.trim() ||
        "";
      const firstName = display ? display.split(/\s+/)[0] : undefined;
      const hasPassword = Boolean(approvedUser.passwordHash && approvedUser.passwordHash.length > 0);
      const approvalEmailSignInOnly = getEnv().ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY === true;
      // Credential invite first: independent of xAI per-user collection bootstrap (quota errors there must not block password setup).
      if (approvedUserObjectId && !hasPassword && !approvalEmailSignInOnly) {
        const issued = await issueCredentialInviteForUser(approvedUserObjectId);
        if (issued) {
          sent = await sendAccessApprovedPasswordInviteEmail({
            request,
            to: notifyEmail,
            rawToken: issued.rawToken,
            ...(firstName ? { firstName } : {})
          });
          if (sent) {
            channel = "credential_invite";
            await createAuditEvent({
              entityType: "access_request",
              entityId: requestId,
              action: "credential_invite_email_sent",
              actor: {
                userId: session.userId,
                email: session.email,
                username: session.username
              },
              details: {
                userId: existing.userId
              }
            });
          } else {
            console.warn(
              "[access-request/approve] credential invite email not sent (desk SMTP off or failure)",
              { userId: approvedUserObjectId.toHexString() }
            );
            await createAuditEvent({
              entityType: "access_request",
              entityId: requestId,
              action: "credential_invite_email_failed",
              actor: {
                userId: session.userId,
                email: session.email,
                username: session.username
              },
              details: {
                userId: existing.userId,
                reason: "desk_smtp_off_or_send_failed"
              }
            });
          }
        } else {
          await createAuditEvent({
            entityType: "access_request",
            entityId: requestId,
            action: "credential_invite_issue_failed",
            actor: {
              userId: session.userId,
              email: session.email,
              username: session.username
            },
            details: {
              userId: existing.userId,
              reason: "invite_issue_returned_null"
            }
          });
          const fallbackSent = await sendAccessApprovedSignInEmail({
            request,
            to: notifyEmail,
            ...(firstName ? { firstName } : {})
          });
          sent = fallbackSent;
          if (fallbackSent) {
            channel = "sign_in_reminder";
          }
          if (!fallbackSent) {
            await createAuditEvent({
              entityType: "access_request",
              entityId: requestId,
              action: "access_approved_email_failed",
              actor: {
                userId: session.userId,
                email: session.email,
                username: session.username
              },
              details: {
                userId: existing.userId,
                reason: "invite_issue_failed_and_fallback_email_failed"
              }
            });
          }
        }
      } else if (hasPassword || approvalEmailSignInOnly) {
        sent = await sendAccessApprovedSignInEmail({
          request,
          to: notifyEmail,
          ...(firstName ? { firstName } : {})
        });
        if (sent) {
          channel = "sign_in_reminder";
          await createAuditEvent({
            entityType: "access_request",
            entityId: requestId,
            action: "access_approved_email_sent",
            actor: {
              userId: session.userId,
              email: session.email,
              username: session.username
            },
            details: {
              userId: existing.userId
            }
          });
        } else {
          await createAuditEvent({
            entityType: "access_request",
            entityId: requestId,
            action: "access_approved_email_failed",
            actor: {
              userId: session.userId,
              email: session.email,
              username: session.username
            },
            details: {
              userId: existing.userId,
              reason: "desk_smtp_off_or_send_failed"
            }
          });
        }
      }
      const sendErr = !sent && deskSmtpConfigured ? consumeLastDeskSmtpSendError() : undefined;
      approvalEmailMeta = {
        deskSmtpConfigured,
        sent,
        ...(channel ? { channel } : {}),
        ...(!sent
          ? {
              failed: true as const,
              failureReason: deskSmtpConfigured
                ? ("smtp_send_failed" as const)
                : ("smtp_not_configured" as const),
              ...(!deskSmtpConfigured ? { configHint: explainDeskSmtpConfigBlock() } : {}),
              ...(sendErr ? { sendErrorHint: sendErr } : {})
            }
          : {})
      };
      try {
        await enqueueAccessRequestBootstrap({
          requestId,
          userId: existing.userId,
          userEmail: notifyEmail,
          tenantId: applicantPortfolioTenantId!,
          requestedPlan: effectivePlan,
          actor: {
            userId: session.userId,
            email: session.email,
            username: session.username
          }
        });
      } catch (bootstrapEnqueueError) {
        console.error("[access-request/approve] bootstrap enqueue failed", bootstrapEnqueueError);
        await createAuditEvent({
          entityType: "access_request",
          entityId: requestId,
          action: "bootstrap_enqueue_failed",
          actor: {
            userId: session.userId,
            email: session.email,
            username: session.username
          },
          details: {
            userId: existing.userId,
            reason:
              bootstrapEnqueueError instanceof Error
                ? bootstrapEnqueueError.message.slice(0, 500)
                : "unknown"
          }
        });
      }
    }
  }

  const responseBody: {
    data: ReturnType<typeof serializeAccessRequest>;
    meta?: { approvalEmail: AccessRequestApprovalEmailMeta };
  } = { data: serializeAccessRequest(reviewed) };
  if (approvalEmailMeta !== undefined) {
    responseBody.meta = { approvalEmail: approvalEmailMeta };
  }
  return NextResponse.json(responseBody);
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { requestId } = await context.params;
  if (!ObjectId.isValid(requestId)) {
    return NextResponse.json({ error: "Invalid access request id" }, { status: 400 });
  }

  const deleted = await deleteAccessRequest(requestId, {
    tenantId: undefined
  });
  if (!deleted) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "access_request",
    entityId: requestId,
    action: "deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    }
  });

  return NextResponse.json({ data: { deleted: true, requestId } });
}

function serializeAccessRequest(request: AccessRequest) {
  return {
    ...request,
    requestedPlan: normalizeSubscriptionPlan(request.requestedPlan),
    _id: request._id?.toHexString(),
    tenantId: request.tenantId?.toHexString(),
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString()
  };
}

function serializeAuditEvent(event: {
  action: string;
  createdAt: Date;
  actor: { userId: string; email?: string; username?: string };
  details?: Record<string, unknown>;
}) {
  return {
    action: event.action,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
    details: event.details
  };
}
