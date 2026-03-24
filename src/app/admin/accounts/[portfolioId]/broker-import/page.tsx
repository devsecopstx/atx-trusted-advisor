import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

/** @deprecated Use `/admin/broker-import?portfolioId=…`. */
export default async function AdminAccountsBrokerImportRedirect({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  redirect(`/admin/broker-import?portfolioId=${encodeURIComponent(portfolioId)}`);
}
