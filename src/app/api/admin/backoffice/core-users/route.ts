import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { normalizeSubscriptionPlan, zSubscriptionPlan } from "@/lib/subscription-plan";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    lookupCoreUserBackoffice,
    patchCoreUserBackoffice
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

const zObjectIdString = z
  .string()
  .trim()
  .refine((s) => ObjectId.isValid(s), { message: "Invalid user id" });

const lookupBodySchema = z.object({
  op: z.literal("lookup"),
  by: z.enum(["email", "id"]),
  value: z.string().trim().min(1).max(512)
});

const patchBodySchema = z
  .object({
    op: z.literal("patch"),
    userId: zObjectIdString,
    subscriptionPlan: zSubscriptionPlan.optional(),
    status: z.enum(["active", "suspended"]).optional(),
    roles: z
      .array(z.enum(["global_admin", "advisor", "operator", "viewer"]))
      .min(1)
      .optional(),
    email: z.string().trim().email().optional(),
    xAccountDisplayName: z.string().max(200).optional(),
    xAccountUsername: z.string().max(200).optional(),
    xAccountAvatarUrl: z.union([z.string().url().max(500), z.literal(""), z.null()]).optional(),
    xaiCollectionId: z.union([z.string().max(200), z.literal(""), z.null()]).optional(),
    xaiCollectionName: z.union([z.string().max(500), z.literal(""), z.null()]).optional()
  })
  .refine(
    (body) =>
      body.subscriptionPlan !== undefined ||
      body.status !== undefined ||
      body.roles !== undefined ||
      body.email !== undefined ||
      body.xAccountDisplayName !== undefined ||
      body.xAccountUsername !== undefined ||
      body.xAccountAvatarUrl !== undefined ||
      body.xaiCollectionId !== undefined ||
      body.xaiCollectionName !== undefined,
    { message: "Provide at least one field to patch." }
  );

const bodySchema = z.discriminatedUnion("op", [lookupBodySchema, patchBodySchema]);

function maskLookupValue(by: "email" | "id", value: string): string {
  if (by === "id") {
    return value.trim();
  }
  const [local, domain] = value.split("@");
  if (!domain) {
    return "***";
  }
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function serializeCoreUser(user: CoreUser) {
  return {
    _id: user._id?.toHexString(),
    email: user.email,
    roles: user.roles,
    subscriptionPlan: normalizeSubscriptionPlan(user.subscriptionPlan),
    status: user.status,
    xaiCollectionId: user.xaiCollectionId,
    xaiCollectionName: user.xaiCollectionName,
    xAccount: user.xAccount
      ? {
          xUserId: user.xAccount.xUserId,
          username: user.xAccount.username,
          displayName: user.xAccount.displayName,
          avatarUrl: user.xAccount.avatarUrl,
          linkedAt: user.xAccount.linkedAt.toISOString()
        }
      : undefined,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
    lastLoginIp: user.lastLoginIp,
    lastLoginCountry: user.lastLoginCountry
  };
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.op === "lookup") {
    const user = await lookupCoreUserBackoffice({
      by: parsed.data.by,
      value: parsed.data.value
    });
    await createAuditEvent({
      entityType: "core_user",
      entityId: user?._id?.toHexString() ?? "unknown",
      action: "backoffice_user_lookup",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        by: parsed.data.by,
        valueMask: maskLookupValue(parsed.data.by, parsed.data.value),
        found: Boolean(user?._id)
      }
    });
    if (!user) {
      return NextResponse.json({ data: null, found: false });
    }
    return NextResponse.json({ data: serializeCoreUser(user), found: true });
  }

  const patchInput = parsed.data;
  const patch: Parameters<typeof patchCoreUserBackoffice>[1] = {};
  if (patchInput.subscriptionPlan !== undefined) {
    patch.subscriptionPlan = patchInput.subscriptionPlan;
  }
  if (patchInput.status !== undefined) {
    patch.status = patchInput.status;
  }
  if (patchInput.roles !== undefined) {
    patch.roles = patchInput.roles;
  }
  if (patchInput.email !== undefined) {
    patch.email = patchInput.email;
  }
  if (patchInput.xAccountDisplayName !== undefined) {
    patch.xAccountDisplayName = patchInput.xAccountDisplayName;
  }
  if (patchInput.xAccountUsername !== undefined) {
    patch.xAccountUsername = patchInput.xAccountUsername;
  }
  if (patchInput.xAccountAvatarUrl !== undefined) {
    patch.xAccountAvatarUrl =
      patchInput.xAccountAvatarUrl === "" ? null : patchInput.xAccountAvatarUrl;
  }
  if (patchInput.xaiCollectionId !== undefined) {
    patch.xaiCollectionId = patchInput.xaiCollectionId === "" ? null : patchInput.xaiCollectionId;
  }
  if (patchInput.xaiCollectionName !== undefined) {
    patch.xaiCollectionName =
      patchInput.xaiCollectionName === "" ? null : patchInput.xaiCollectionName;
  }

  const result = await patchCoreUserBackoffice(new ObjectId(patchInput.userId), patch);
  if (!result.ok) {
    if (result.code === "not_found") {
      return NextResponse.json({ error: "User not found", code: result.code }, { status: 404 });
    }
    if (result.code === "duplicate_email") {
      return NextResponse.json({ error: "Email already in use", code: result.code }, { status: 409 });
    }
    return NextResponse.json(
      {
        error: "Linked X account required to edit X profile fields",
        code: result.code
      },
      { status: 400 }
    );
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: patchInput.userId,
    action: "backoffice_user_patch",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      changedKeys: Object.keys(patch)
    }
  });

  return NextResponse.json({ data: serializeCoreUser(result.user) });
}
