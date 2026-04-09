import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getAppUserRouteCatalog } from "@/modules/platform/app-user-route-catalog";

/**
 * Canonical app-user route metadata for platform/compliance DB import.
 * `global_admin` only — returns parsed `data/platform/app-user-route-catalog.json`.
 */
export async function GET() {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  return NextResponse.json(getAppUserRouteCatalog());
}
