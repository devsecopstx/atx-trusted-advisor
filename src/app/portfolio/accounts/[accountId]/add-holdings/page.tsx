import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

/** Legacy URL: positions are managed on the account page (Holdings tab). */
export default async function AddHoldingsRedirectPage({
  params
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
  }
  const { accountId } = await params;
  redirect(`/portfolio/accounts/${encodeURIComponent(accountId)}`);
}
