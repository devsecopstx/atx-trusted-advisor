import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
    adminGetOptionsStrategyPreferenceById,
    adminUpdateOptionsStrategyPreference
} from "@/modules/core-admin/repository";
import type { OptionsStrategyPreference } from "@/modules/core-admin/types";

const DESCRIPTION_MAX = 512_000;

type RouteContext = {
  params: Promise<{ preferenceId: string }>;
};

function serializeFull(doc: OptionsStrategyPreference) {
  return {
    id: doc._id!.toHexString(),
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    sourceRelPath: doc.sourceRelPath ?? "",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    description: z.string().max(DESCRIPTION_MAX).optional()
  })
  .refine((o) => o.name !== undefined || o.description !== undefined, {
    message: "Provide at least one field"
  });

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { preferenceId } = await context.params;
  const doc = await adminGetOptionsStrategyPreferenceById(preferenceId);
  if (!doc?._id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeFull(doc) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { preferenceId } = await context.params;

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

  const updated = await adminUpdateOptionsStrategyPreference({
    id: preferenceId,
    patch: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {})
    }
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Not found or invalid fields" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeFull(updated) });
}
