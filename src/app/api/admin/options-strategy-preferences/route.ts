import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { adminListOptionsStrategyPreferenceSummaries } from "@/modules/core-admin/repository";
import type { OptionsStrategyPreferenceSummary } from "@/modules/core-admin/types";

function serializeSummary(row: OptionsStrategyPreferenceSummary) {
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

  const rows = await adminListOptionsStrategyPreferenceSummaries();
  return NextResponse.json({ data: rows.map(serializeSummary) });
}
