import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

/** Legacy hub URL — custodian accounts are edited under Portfolios → Manage accounts. */
export default async function AdminAccountsHubPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/portfolios");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  redirect("/admin/portfolios");
}
