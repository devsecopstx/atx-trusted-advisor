import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated Use `/admin/tenant-preferences?tab=workspace-limits`. */
export default function AdminTenantWorkspaceLimitsRedirectPage() {
  redirect("/admin/tenant-preferences?tab=workspace-limits");
}
