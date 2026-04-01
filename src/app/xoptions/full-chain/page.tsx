import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XoptionsFullChainWorkspace } from "@/app/xoptions/xoptions-full-chain-workspace";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ symbol?: string; weeks?: string }>;
};

export default async function XoptionsFullChainPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xoptions/full-chain");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const sp = searchParams ? await searchParams : {};
  const sym =
    typeof sp.symbol === "string" && sp.symbol.trim().length > 0
      ? sp.symbol.trim().toUpperCase()
      : "TSLA";
  const wRaw = typeof sp.weeks === "string" ? parseInt(sp.weeks, 10) : 14;
  const weeks = Number.isFinite(wRaw) && wRaw > 0 ? wRaw : 14;

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xoptions" feedbackPageLabel="xOptions" session={session} />
      <div className="xchat-body px-4 py-6 md:px-8">
        <XoptionsFullChainWorkspace initialSymbol={sym} initialWeeks={weeks} />
      </div>
    </div>
  );
}
