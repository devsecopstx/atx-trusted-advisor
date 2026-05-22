import { getTenantByHexId } from "@/modules/identity/repository";

export type AdminTenantLabel = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
};

/** Resolve `core_tenants` name/slug for admin scheduled-task / task-run rows. */
export async function resolveAdminTenantLabelsByHex(
  tenantIdHexes: Iterable<string | null | undefined>
): Promise<Map<string, AdminTenantLabel>> {
  const unique = [
    ...new Set(
      [...tenantIdHexes]
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0)
    )
  ];
  const map = new Map<string, AdminTenantLabel>();
  await Promise.all(
    unique.map(async (hex) => {
      const row = await getTenantByHexId(hex);
      if (!row) {
        return;
      }
      const slug = row.slug?.trim() ?? "";
      const name = row.name?.trim() || slug || hex;
      map.set(hex, { tenantId: hex, tenantName: name, tenantSlug: slug });
    })
  );
  return map;
}

export function pickAdminTenantLabel(
  map: Map<string, AdminTenantLabel>,
  tenantIdHex: string | null | undefined
): AdminTenantLabel | null {
  if (!tenantIdHex?.trim()) {
    return null;
  }
  return map.get(tenantIdHex.trim()) ?? null;
}
