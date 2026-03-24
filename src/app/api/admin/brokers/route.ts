import { NextResponse } from "next/server";
import { z } from "zod";

import { adminBrokerSlugSchema } from "@/lib/admin/broker-catalog-guard";
import { requireAdminSession } from "@/lib/api-auth";
import { adminCreateBrokerCatalogEntry, adminListBrokerCatalog } from "@/modules/core-admin/repository";
import type { BrokerCatalogEntry } from "@/modules/core-admin/types";

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

const postSchema = z.object({
  type: adminBrokerSlugSchema,
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(2000).optional(),
  iconUrl: z.string().trim().max(2048).optional()
});

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const rows = await adminListBrokerCatalog();
  return NextResponse.json({ data: rows.map(serializeBroker) });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await adminCreateBrokerCatalogEntry({
    type: parsed.data.type,
    name: parsed.data.name,
    description: parsed.data.description,
    iconUrl: parsed.data.iconUrl
  });
  if (!created?._id) {
    return NextResponse.json(
      { error: "Could not create broker (duplicate type slug or invalid fields?)" },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: serializeBroker(created) }, { status: 201 });
}
