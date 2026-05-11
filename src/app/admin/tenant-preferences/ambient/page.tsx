import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated Use `/admin/tenant-preferences?tab=ambient`. */
export default function AdminTenantAmbientExperienceRedirectPage() {
  redirect("/admin/tenant-preferences?tab=ambient");
}
