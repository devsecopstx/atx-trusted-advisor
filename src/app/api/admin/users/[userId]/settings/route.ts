import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { getUserBootstrapCollectionByUserId } from "@/modules/core-admin/access-request-bootstrap";
import {
    getUserAdminSettings,
    upsertUserAdminSettings
} from "@/modules/core-admin/repository";
import { getCoreUserById } from "@/modules/identity/repository";
import { getPersonaById } from "@/modules/xchat/repository";
import { ATXFINANCE_COLLECTION_ID } from "@/modules/xchat/types";

const updateSettingsSchema = z.object({
  assignedPersonaId: z.string().trim().optional(),
  finraLicenseUploadUrl: z.string().trim().max(500).optional(),
  broker: z.object({
    provider: z.enum(["alpaca", "interactive-brokers", "paper"]),
    accountRef: z.string().min(1),
    enabled: z.boolean()
  }),
  portfolio: z.object({
    riskProfile: z.enum(["conservative", "balanced", "growth"]),
    baseCurrency: z.enum(["USD", "EUR", "GBP"]),
    rebalanceFrequencyDays: z.number().int().positive()
  }),
  account: z.object({
    accountStatus: z.enum(["active", "suspended"]),
    maxConcurrentSessions: z.number().int().min(1).max(20),
    timezone: z.string().min(1)
  }),
  notificationDefaults: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
    digestHourUTC: z.number().int().min(0).max(23)
  })
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type LinkedCollection = {
  collectionId: string;
  collectionName?: string;
  source: "atxfinance_default" | "user_bootstrap" | "assigned_persona";
};

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  const settings = await getUserAdminSettings(userId, {
    tenantId: session.tenantId
  });

  if (!settings) {
    return NextResponse.json({ error: "User settings not found" }, { status: 404 });
  }

  const linkedCollections = await resolveUserLinkedCollections({
    userId,
    tenantId: session.tenantId,
    assignedPersonaId: settings.assignedPersonaId
  });

  return NextResponse.json({
    data: settings,
    metadata: {
      linkedCollections
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const user = await getCoreUserById(new ObjectId(userId));
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const json = await request.json();
  const parsed = updateSettingsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const assignedPersonaId =
    parsed.data.assignedPersonaId && parsed.data.assignedPersonaId.length > 0
      ? parsed.data.assignedPersonaId
      : undefined;
  const finraLicenseUploadUrl =
    parsed.data.finraLicenseUploadUrl && parsed.data.finraLicenseUploadUrl.length > 0
      ? parsed.data.finraLicenseUploadUrl
      : undefined;
  if (assignedPersonaId && !ObjectId.isValid(assignedPersonaId)) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: {
          fieldErrors: {
            assignedPersonaId: ["assignedPersonaId must be a valid persona ObjectId"]
          }
        }
      },
      { status: 400 }
    );
  }
  if (assignedPersonaId) {
    const isAppUser = user.roles.some((role) => role === "advisor" || role === "operator" || role === "viewer");
    if (!isAppUser) {
      return NextResponse.json(
        {
          error: "Assigned persona is only supported for app_user roles (advisor/operator/viewer)",
          code: "persona_assignment_requires_app_user"
        },
        { status: 400 }
      );
    }

    const assignedPersona = await getPersonaById(assignedPersonaId);
    if (!assignedPersona) {
      return NextResponse.json(
        {
          error: "Assigned persona not found",
          code: "assigned_persona_not_found"
        },
        { status: 404 }
      );
    }
    if (assignedPersona.status !== "published") {
      return NextResponse.json(
        {
          error: "Assigned persona must be published",
          code: "assigned_persona_not_published"
        },
        { status: 400 }
      );
    }
  }

  const updated = await upsertUserAdminSettings(
    userId,
    {
      ...parsed.data,
      assignedPersonaId,
      finraLicenseUploadUrl
    },
    {
    tenantId: session.tenantId
    }
  );
  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "updated_settings",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      changedFields: Object.keys(parsed.data)
    }
  });
  return NextResponse.json({ data: updated });
}

async function resolveUserLinkedCollections(input: {
  userId: string;
  tenantId?: string;
  assignedPersonaId?: string;
}): Promise<LinkedCollection[]> {
  const linked: LinkedCollection[] = [
    {
      collectionId: ATXFINANCE_COLLECTION_ID,
      collectionName: "aTxFinance Default",
      source: "atxfinance_default"
    }
  ];

  const bootstrapCollection = await getUserBootstrapCollectionByUserId({
    userId: input.userId,
    tenantId: input.tenantId
  });
  if (bootstrapCollection?.collectionId) {
    linked.push({
      collectionId: bootstrapCollection.collectionId,
      collectionName: bootstrapCollection.collectionName,
      source: "user_bootstrap"
    });
  }

  const assignedPersonaId = input.assignedPersonaId?.trim();
  if (assignedPersonaId && ObjectId.isValid(assignedPersonaId)) {
    const assignedPersona = await getPersonaById(assignedPersonaId);
    const personaCollectionId = assignedPersona?.xaiCollection?.collectionId?.trim();
    if (personaCollectionId) {
      linked.push({
        collectionId: personaCollectionId,
        collectionName: assignedPersona?.xaiCollection?.collectionName,
        source: "assigned_persona"
      });
    }
  }

  const deduped = new Map<string, LinkedCollection>();
  for (const item of linked) {
    const id = item.collectionId.trim();
    if (!id || deduped.has(id)) {
      continue;
    }
    deduped.set(id, { ...item, collectionId: id });
  }

  return Array.from(deduped.values());
}
