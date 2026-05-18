import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel } from "@/lib/env";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canCreateStrategyJobFromApp, isGlobalAdmin } from "@/modules/identity/authorization";
import { GlobalFooter } from "../ui/global-footer";
import "../xchat/xchat-shell.css";
import { AdminLayoutShell } from "./ui/admin-layout-shell";
import { AdminSessionPanel } from "./ui/admin-session-panel";
import { AdminShellThemeLock } from "./ui/admin-shell-theme-lock";

type AdminLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "Hub"
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  const pathname = (await headers()).get("x-pathname") ?? "";
  const batchSubtree =
    pathname === "/admin/batch" || pathname.startsWith("/admin/batch/");
  const allowedShell =
    isGlobalAdmin(session.roles) ||
    (batchSubtree && canCreateStrategyJobFromApp(session.roles));
  if (!allowedShell) {
    redirect("/xchat");
  }

  const mongoConnection = getMongoConnectionLabel();
  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);

  return (
    <div className="admin-layout">
      <AdminShellThemeLock />
      <div className="admin-layout-product-header sticky top-0 z-50 shrink-0 bg-[var(--xf-bg-800)]">
        <AppUserApprovedHeader
          current={null}
          session={session}
          workspaceTenant={workspaceTenant}
          trailingExtras={
            <div className="admin-approved-header-session admin-topbar-session ml-2 flex shrink-0 items-center border-l border-[var(--xf-border-subtle)] pl-2">
              <AdminSessionPanel
                avatarUrl={session.avatarUrl}
                displayName={session.displayName}
                email={session.email}
                mongoConnection={mongoConnection}
                xUserId={session.xUserId}
                username={session.username}
              />
            </div>
          }
        />
      </div>
      <main className="admin-layout-content">
        <AdminLayoutShell>{children}</AdminLayoutShell>
      </main>
      <GlobalFooter />
    </div>
  );
}
