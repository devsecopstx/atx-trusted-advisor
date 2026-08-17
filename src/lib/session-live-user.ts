import { ObjectId } from "mongodb";

import type { SessionUser } from "@/lib/auth";
import { getCoreUserByIdCached } from "@/lib/server-request-cache";
import { canUserLogin, isGlobalAdmin, normalizeCoreRoles } from "@/modules/identity/authorization";

export type LiveSessionDenial = {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
};

export type LiveSessionOk = {
  ok: true;
  session: SessionUser;
};

/**
 * Re-read `core_users` so cookie roles/status cannot outlive a suspend, demote, or revoke.
 * Fail-closed on Mongo errors for privileged routes.
 */
export async function attachLiveRolesFromCoreUser(session: SessionUser): Promise<LiveSessionOk | LiveSessionDenial> {
  const userIdHex = session.userId.trim();
  if (!ObjectId.isValid(userIdHex)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  let user;
  try {
    user = await getCoreUserByIdCached(userIdHex);
  } catch {
    return { ok: false, status: 503, error: "Session verification unavailable" };
  }
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (user.status === "suspended") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  const roles = normalizeCoreRoles(user.roles ?? []);
  if (!canUserLogin(roles)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return {
    ok: true,
    session: {
      ...session,
      email: user.email || session.email,
      roles
    }
  };
}

export function liveSessionIsGlobalAdmin(result: LiveSessionOk | LiveSessionDenial): result is LiveSessionOk {
  return result.ok && isGlobalAdmin(result.session.roles);
}
