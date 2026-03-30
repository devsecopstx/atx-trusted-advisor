import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated Use /admin/tenant-preferences/workspace-limits */
export default function AdminTenantWorkspaceRedirectPage() {
  redirect("/admin/tenant-preferences/workspace-limits");
}
