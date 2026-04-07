import { redirect } from "next/navigation";
import { Suspense } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

import { PortfoliosWorkspaceData } from "./portfolios-workspace-data";
import { PortfoliosWorkspaceSkeleton } from "./portfolios-workspace-skeleton";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";
import "@/app/xchat/xchat.css";
import "./portfolios-dashboard.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ focus?: string | string[] }>;
};

function singleParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) {
    return undefined;
  }
  return Array.isArray(v) ? v[0] : v;
}

export default async function PortfoliosPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat?next=/portfolios");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const sp = searchParams ? await searchParams : {};
  const focusRaw = singleParam(sp.focus)?.trim() ?? "";

  return (
    <>
      <Suspense fallback={<PortfoliosWorkspaceSkeleton />}>
        <PortfoliosWorkspaceData focusRaw={focusRaw} session={session} />
      </Suspense>
      <GlobalFooter />
    </>
  );
}
