/**
 * React `cache()` dedupes identical async reads within one server request (RSC, Route Handlers, server actions).
 * Import from server-only code only — not from client components.
 */
import { cache } from "react";

import { getTenantByHexId } from "@/modules/identity/repository";
import {
    getPersonaById,
    listPersonas,
    listPersonasByStatus,
    resolveDefaultXchatPersonaForSession
} from "@/modules/xchat/repository";
import type { PersonaConfig, PersonaStatus } from "@/modules/xchat/types";

export const getTenantByHexIdCached = cache(async (tenantIdHex: string) =>
  getTenantByHexId(tenantIdHex.trim())
);

export const listPersonasCached = cache(async () => listPersonas());

export const listPersonasByStatusCached = cache(async (status: PersonaStatus) =>
  listPersonasByStatus(status)
);

export const getPersonaByIdCached = cache(async (personaId: string) =>
  getPersonaById(personaId.trim())
);

function stableRolesKey(roles: readonly string[]): string {
  if (roles.length === 0) {
    return "";
  }
  return [...new Set(roles.map((r) => String(r).trim()).filter(Boolean))].sort().join("\0");
}

const resolveDefaultXchatPersonaForRolesKey = cache(
  async (rolesKey: string): Promise<PersonaConfig | null> => {
    const roles = rolesKey === "" ? [] : rolesKey.split("\0");
    return resolveDefaultXchatPersonaForSession(roles);
  }
);

export function loadDefaultXchatPersonaForSessionDeduped(
  roles: readonly string[]
): Promise<PersonaConfig | null> {
  return resolveDefaultXchatPersonaForRolesKey(stableRolesKey(roles));
}
