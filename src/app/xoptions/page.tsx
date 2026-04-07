import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

import { XoptionsStrategyBuilderMount } from "./xoptions-strategy-builder-mount";

export const dynamic = "force-dynamic";

export default async function XoptionsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xoptions");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xoptions" feedbackPageLabel="xOptions" session={session} />
      <div className="xchat-body px-4 py-6 md:px-8">
        <AppUserCollapsibleRailLayout
          rail={<AppUserAccountPublicRailForSession railVariant="workspace-product" session={session} />}
        >
          <XoptionsStrategyBuilderMount />
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
