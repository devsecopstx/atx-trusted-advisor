import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminAccountsPortfolioPicker } from "./ui/admin-accounts-portfolio-picker";

export default async function AdminAccountsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/accounts");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <AdminAccountsPortfolioPicker />
    </div>
  );
}
