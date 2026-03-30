import { redirect } from "next/navigation";

export default function AdminTenantPreferencesIndexPage() {
  redirect("/admin/tenant-preferences/workspace-limits");
}
