import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    createDeployNoteConfig,
    listDeployNoteConfigs
} from "@/modules/core-admin/repository";
import type { DeployNoteConfig } from "@/modules/core-admin/types";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  environment: z.enum(["staging", "production"]).optional()
});

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().max(2000).optional()
);

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  environment: z.enum(["staging", "production"]),
  enabled: z.boolean().optional().default(true),
  includeRunUrl: z.boolean().optional().default(true),
  includeActor: z.boolean().optional().default(true),
  defaultDeploymentNotes: optionalTrimmedString,
  defaultHotfixNotes: optionalTrimmedString
});

export async function GET(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) return proxied;

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    environment: url.searchParams.get("environment") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const configs = await listDeployNoteConfigs({
    limit: parsed.data.limit,
    environment: parsed.data.environment,
    tenantId: session.tenantId
  });

  return NextResponse.json({ data: configs.map(serializeDeployNoteConfig) });
}

export async function POST(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) return proxied;

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid deploy note config payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createDeployNoteConfig({
    ...parsed.data,
    tenantId: session.tenantId
  });

  if (created._id) {
    await createAuditEvent({
      entityType: "deploy_note_config",
      entityId: created._id.toHexString(),
      action: "created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        environment: created.environment,
        enabled: created.enabled
      }
    });
  }

  return NextResponse.json({ data: serializeDeployNoteConfig(created) }, { status: 201 });
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
