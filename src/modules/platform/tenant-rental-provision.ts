import type { Db, ObjectId } from "mongodb";

import { provisionDefaultPortfolioForUser } from "@/modules/core-admin/repository";
import { ensureCoreTenantRentalIndexes } from "@/modules/platform/tenant-rental-indexes";
import { ensureRentalAdvisorPersonaForTenant } from "@/modules/platform/tenant-rental-persona-seed";
import type { TenantRentalProfile } from "@/modules/platform/tenant-rental-types";

/**
 * After `core_tenants` upsert: pins `rentalExpiresAt`, ensures rental persona + `rentalProfile.defaultPersonaId`.
 */
export async function finalizeTenantRentalProvisioning(
  db: Db,
  input: {
    tenantId: ObjectId;
    tenantSlug: string;
    rentalProfile: TenantRentalProfile;
  }
): Promise<void> {
  await ensureCoreTenantRentalIndexes(db);
  const sampleUserId = `rental-sample:${input.tenantSlug}`;
  const sampleProvision = await provisionDefaultPortfolioForUser({
    userId: sampleUserId,
    tenantId: input.tenantId.toHexString(),
    watchlistSymbols: ["TSLA", "AAPL"]
  });
  const personaId = await ensureRentalAdvisorPersonaForTenant(db, {
    tenantSlug: input.tenantSlug,
    strategyBias: input.rentalProfile.strategyBias,
    xaiModelOverride: input.rentalProfile.xaiModelOverride
  });

  const rentalProfile: TenantRentalProfile = {
    ...input.rentalProfile,
    defaultPersonaId: personaId,
    sampleUserId,
    samplePortfolioId: sampleProvision.portfolio._id
  };

  await db.collection("core_tenants").updateOne(
    { _id: input.tenantId },
    {
      $set: {
        rentalProfile,
        rentalExpiresAt: input.rentalProfile.expiresAt,
        updatedAt: new Date()
      }
    }
  );
}
