import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    deleteDeployNoteConfigById,
    getDeployNoteConfigById,
    updateDeployNoteConfigById
} from "@/modules/core-admin/repository";
import type { DeployNoteConfig } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ configId: string }>;
};

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (value === null) {
      return null;
    }
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(2000).nullable().optional()
);

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    environment: z.enum(["staging", "production"]).optional(),
    enabled: z.boolean().optional(),
    includeRunUrl: z.boolean().optional(),
    includeActor: z.boolean().optional(),
    defaultDeploymentNotes: optionalTrimmedString,
    defaultHotfixNotes: optionalTrimmedString
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.environment !== undefined ||
      value.enabled !== undefined ||
      value.includeRunUrl !== undefined ||
      value.includeActor !== undefined ||
      value.defaultDeploymentNotes !== undefined ||
      value.defaultHotfixNotes !== undefined,
    { message: "Provide at least one field to update." }
  );

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { configId } = await context.params;
  const config = await getDeployNoteConfigById(configId, { tenantId: session.tenantId });
  if (!config) {
    return NextResponse.json({ error: "Deploy note config not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeDeployNoteConfig(config) });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { configId } = await context.params;
  const json = await request.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid deploy note config payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch = {
    ...parsed.data,
    defaultDeploymentNotes:
      parsed.data.defaultDeploymentNotes === undefined
        ? undefined
        : parsed.data.defaultDeploymentNotes ?? undefined,
    defaultHotfixNotes:
      parsed.data.defaultHotfixNotes === undefined
        ? undefined
        : parsed.data.defaultHotfixNotes ?? undefined
  };

  const updated = await updateDeployNoteConfigById({
    configId,
    patch,
    tenantId: session.tenantId
  });

  if (!updated) {
    return NextResponse.json({ error: "Deploy note config not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "deploy_note_config",
    entityId: configId,
    action: "updated",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: { changedFields: Object.keys(parsed.data) }
  });

  return NextResponse.json({ data: serializeDeployNoteConfig(updated) });
}

export async function DELETE(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { configId } = await context.params;
  const deleted = await deleteDeployNoteConfigById(configId, { tenantId: session.tenantId });
  if (!deleted) {
    return NextResponse.json({ error: "Deploy note config not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "deploy_note_config",
    entityId: configId,
    action: "deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    }
  });

  return NextResponse.json({ data: { deleted: true, configId } });
}

function serializeDeployNoteConfig(config: DeployNoteConfig) {
  return {
    _id: config._id?.toHexString(),
    name: config.name,
    environment: config.environment,
    enabled: config.enabled,
    includeRunUrl: config.includeRunUrl,
    includeActor: config.includeActor,
    defaultDeploymentNotes: config.defaultDeploymentNotes,
    defaultHotfixNotes: config.defaultHotfixNotes,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString()
  };
}
