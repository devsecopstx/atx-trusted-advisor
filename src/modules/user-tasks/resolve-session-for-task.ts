import type { SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getCoreUserById } from "@/modules/identity/repository";
import type { TenantMembership } from "@/modules/identity/types";
import type { UserTask } from "@/modules/user-tasks/types";

const CORE_TENANT_MEMBERSHIPS = "core_tenant_memberships";

/**
 * Builds a {@link SessionUser} for trusted automation so downstream routes (e.g. `/api/xchat/ask`)
 * enforce the same persona/plan gates as interactive sessions.
 */
export async function resolveSessionUserForUserTask(task: UserTask): Promise<SessionUser | null> {
  const user = await getCoreUserById(task.userId);
  if (!user?._id || !user.email) {
    return null;
  }
  const db = await getDb();
  const membership = await db.collection<TenantMembership>(CORE_TENANT_MEMBERSHIPS).findOne({
    userId: task.userId,
    tenantId: task.tenantId
  });
  if (!membership) {
    return null;
  }
  const xUserId = user.xAccount?.xUserId ?? "automation";
  const username = user.xAccount?.username ?? user.email.split("@")[0] ?? "user";
  return {
    userId: user._id.toHexString(),
    email: user.email,
    roles: user.roles,
    tenantId: task.tenantId.toHexString(),
    tenantRole: membership.role,
    xUserId,
    username,
    displayName: user.xAccount?.displayName,
    avatarUrl: user.xAccount?.avatarUrl
  };
}
