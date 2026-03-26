import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
  adminDeleteOptionsStrategy,
  adminGetOptionsStrategyById,
  adminUpdateOptionsStrategy
} from "@/modules/core-admin/repository";
import type { OptionsStrategy } from "@/modules/core-admin/types";

const DESCRIPTION_MAX = 512_000;

function serializeFull(doc: OptionsStrategy) {
  return {
    id: doc._id!.toHexString(),
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    filters: doc.filters ?? null,
    sourceRelPath: doc.sourceRelPath ?? "",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    description: z.string().max(DESCRIPTION_MAX).optional(),
    filters: z.record(z.string(), z.unknown()).nullable().optional(),
    sourceRelPath: z.string().trim().max(512).nullable().optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Provide at least one field" });

export async function GET(_request: Request, context: { params: Promise<{ strategyId: string }> }) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { strategyId } = await context.params;
  const doc = await adminGetOptionsStrategyById(strategyId);
  if (!doc?._id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: serializeFull(doc) });
}

export async function PATCH(request: Request, context: { params: Promise<{ strategyId: string }> }) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { strategyId } = await context.params;

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

  const patch: Partial<Pick<OptionsStrategy, "name" | "description" | "filters" | "sourceRelPath">> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.filters !== undefined) patch.filters = parsed.data.filters;
  if (parsed.data.sourceRelPath !== undefined) patch.sourceRelPath = parsed.data.sourceRelPath ?? undefined;

  const updated = await adminUpdateOptionsStrategy({ id: strategyId, patch });
  if (!updated?._id) {
    return NextResponse.json({ error: "Not found or invalid fields" }, { status: 404 });
  }
  return NextResponse.json({ data: serializeFull(updated) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ strategyId: string }> }) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { strategyId } = await context.params;
  const ok = await adminDeleteOptionsStrategy(strategyId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
