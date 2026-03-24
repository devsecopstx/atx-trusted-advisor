import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { adminDeleteBrokerCatalogEntry, adminUpdateBrokerCatalogEntry } from "@/modules/core-admin/repository";
import type { BrokerCatalogEntry } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ brokerId: string }>;
};

function serializeBroker(b: BrokerCatalogEntry) {
  return {
    _id: b._id!.toHexString(),
    type: b.type,
    name: b.name,
    description: b.description ?? "",
    iconUrl: b.iconUrl ?? "",
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString()
  };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    description: z.union([z.string().trim().max(2000), z.null()]).optional(),
    iconUrl: z.union([z.string().trim().max(2048), z.null()]).optional()
  })
  .refine((o) => o.name !== undefined || o.description !== undefined || o.iconUrl !== undefined, {
    message: "Provide at least one field"
  });

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { brokerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch: Partial<Pick<BrokerCatalogEntry, "name" | "description" | "iconUrl">> = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name;
  }
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description === null ? undefined : parsed.data.description;
  }
  if (parsed.data.iconUrl !== undefined) {
    patch.iconUrl = parsed.data.iconUrl === null ? undefined : parsed.data.iconUrl;
  }

  const updated = await adminUpdateBrokerCatalogEntry({ id: brokerId, patch });
  if (!updated?._id) {
    return NextResponse.json({ error: "Broker not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeBroker(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { brokerId } = await context.params;
  const ok = await adminDeleteBrokerCatalogEntry(brokerId);
  if (!ok) {
    return NextResponse.json({ error: "Broker not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
