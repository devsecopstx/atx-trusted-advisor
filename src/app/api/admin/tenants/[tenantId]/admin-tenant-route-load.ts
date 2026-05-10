import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";
import type { Tenant } from "@/modules/identity/types";

/** Resolve tenant by URL param hex id with global_admin session fallback (matches workspace-limits). */
export async function loadTenantForAdminTenantRoute(
  urlTenantId: string,
  sessionTenantId: string
): Promise<Tenant | null> {
  const url = urlTenantId.trim();
  let tenant = await getTenantByHexIdCached(url);
  if (tenant?._id) {
    return tenant;
  }
  if (url === sessionTenantId.trim()) {
    const resolved = await resolveTenantIdHexForGlobalAdminConsole(sessionTenantId);
    if (resolved) {
      tenant = await getTenantByHexIdCached(resolved);
    }
  }
  return tenant?._id ? tenant : null;
}
