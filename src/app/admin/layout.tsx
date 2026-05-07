import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel } from "@/lib/env";
import { canCreateStrategyJobFromApp, isGlobalAdmin } from "@/modules/identity/authorization";
import { GlobalFooter } from "../ui/global-footer";
import { XchatHeaderBrand } from "../ui/xchat-header-brand";
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

  return (
    <div className="admin-layout">
      <AdminShellThemeLock />
      <header className="admin-topbar">
        <Link className="admin-topbar-brand" href="/admin">
          <XchatHeaderBrand />
        </Link>
        <div className="admin-topbar-actions">
          <div className="admin-topbar-trailing">
            <div className="admin-topbar-session">
              <AdminSessionPanel
                avatarUrl={session.avatarUrl}
                displayName={session.displayName}
                email={session.email}
                mongoConnection={mongoConnection}
                xUserId={session.xUserId}
                username={session.username}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="admin-layout-content">
        <AdminLayoutShell>{children}</AdminLayoutShell>
      </main>
      <GlobalFooter />
    </div>
  );
}
