import { NextResponse } from "next/server";
import { z } from "zod";

import { adminBrokerCatalogHasType, adminEnsureBrokerCatalogReady } from "@/modules/core-admin/repository";

export const adminBrokerSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z][a-z0-9_]*$/)
  .transform((s) => s.toLowerCase());

/** Rejects when the slug is not present in the admin broker catalog (after defaults are seeded). */
export async function requireKnownBrokerCatalogSlug(slug: string): Promise<NextResponse | null> {
  await adminEnsureBrokerCatalogReady();
  if (!(await adminBrokerCatalogHasType(slug))) {
    return NextResponse.json({ error: "Unknown broker type" }, { status: 400 });
  }
  return null;
}
