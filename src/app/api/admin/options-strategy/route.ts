import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { adminCreateOptionsStrategy, adminListOptionsStrategySummaries } from "@/modules/core-admin/repository";
import type { OptionsStrategySummary } from "@/modules/core-admin/types";

function serializeSummary(row: OptionsStrategySummary) {
  return {
    id: row._id.toHexString(),
    slug: row.slug,
    name: row.name,
    sourceRelPath: row.sourceRelPath ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const rows = await adminListOptionsStrategySummaries();
  return NextResponse.json({ data: rows.map(serializeSummary) });
}

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{0,62}$/),
  name: z.string().trim().min(1).max(128),
  description: z.string(),
  filters: z.record(z.string(), z.unknown()).nullable().optional(),
  sourceRelPath: z.string().trim().max(512).optional()
});

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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const created = await adminCreateOptionsStrategy(parsed.data);
  if (!created?._id) {
    return NextResponse.json({ error: "Create failed (duplicate slug or invalid fields)" }, { status: 400 });
  }
  return NextResponse.json({
    data: {
      id: created._id.toHexString(),
      slug: created.slug,
      name: created.name,
      description: created.description,
      filters: created.filters ?? null,
      sourceRelPath: created.sourceRelPath ?? "",
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    }
  });
}
