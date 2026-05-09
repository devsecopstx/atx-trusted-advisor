import { ObjectId } from "mongodb";

import { getTenantByHexId } from "@/modules/identity/repository";
import { isAmbientMarketVeilEnabledForTenant } from "@/modules/identity/tenant-branding-preferences";

export type WorkspaceTenantHeaderContext = {
  idHex: string;
  slug: string;
  name: string;
  /**
   * `tenantPreferences.ambient_market_veil` resolved (default-on); pages pass through to
   * `<MarketVeilBackground />` to gate ambient market-veil rendering.
   */
  ambientMarketVeilEnabled: boolean;
};

/** Same rule as `/portfolios` workspace header: require slug + display name on the tenant row. */
export async function getWorkspaceTenantHeaderContext(
  tenantIdHex: string | undefined | null
): Promise<WorkspaceTenantHeaderContext | null> {
  const sessionTenantHex = tenantIdHex?.trim() ?? "";
  if (!sessionTenantHex || !ObjectId.isValid(sessionTenantHex)) {
    return null;
  }
  const tenantRow = await getTenantByHexId(sessionTenantHex);
  if (!tenantRow?._id || !tenantRow.slug?.trim() || !tenantRow.name?.trim()) {
    return null;
  }
  return {
    idHex: tenantRow._id.toHexString(),
    slug: tenantRow.slug.trim(),
    name: tenantRow.name.trim(),
    ambientMarketVeilEnabled: isAmbientMarketVeilEnabledForTenant(tenantRow)
  };
}
