import { parseJson } from "@/app/admin/ui/http";
import type { AdminAccessRequest } from "@/lib/admin/admin-access-request";

export type AdminManageUsersApiUser = {
  _id: string;
  email?: string;
  role?: string;
  subscriptionPlan?: string;
  status?: string;
  pendingAccess?: boolean;
  tenantMemberships?: Array<{
    tenantId: string;
    slug: string;
    name: string;
    tenantRole: "tenant_admin" | "member";
    isDefaultSessionTenant: boolean;
  }>;
  [key: string]: unknown;
};

export type AdminManageUsersDirectoryPayload = {
  users: AdminManageUsersApiUser[];
  openAccessRequests: AdminAccessRequest[];
};

export async function fetchAdminManageUsersDirectory(
  userLimit = 200
): Promise<AdminManageUsersDirectoryPayload> {
  const [usersRes, accessRes] = await Promise.all([
    fetch(`/api/admin/users?limit=${userLimit}`, { cache: "no-store" }),
    fetch("/api/admin/access-requests?status=open", { cache: "no-store" })
  ]);
  const usersPayload = await parseJson<{ data: AdminManageUsersApiUser[] }>(usersRes);
  const accessPayload = await parseJson<{ data: AdminAccessRequest[] }>(accessRes);
  const users = usersPayload.data.filter((user): user is AdminManageUsersApiUser & { _id: string } =>
    Boolean(user._id)
  );
  return {
    users,
    openAccessRequests: accessPayload.data
  };
}
