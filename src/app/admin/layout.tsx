import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { GlobalFooter } from "../ui/global-footer";
import { XchatHeaderBrand } from "../ui/xchat-header-brand";
import { AdminLeftRail } from "./ui/admin-left-rail";
import { AdminSessionPanel } from "./ui/admin-session-panel";

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
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  const mongoConnection = getMongoConnectionLabel();

  return (
    <div className="admin-layout">
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
        <div className="admin-layout-shell">
          <AdminLeftRail />
          <div className="admin-layout-main">{children}</div>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
