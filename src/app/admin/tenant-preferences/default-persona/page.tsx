import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated Use `/admin/tenant-preferences?tab=persona`. */
export default function AdminTenantDefaultPersonaRedirectPage() {
  redirect("/admin/tenant-preferences?tab=persona");
}
