import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { AtxFinanceLogo } from "../ui/atxfinance-logo";
import { GlobalFooter } from "../ui/global-footer";
import { AdminSessionPanel } from "./ui/admin-session-panel";

type AdminLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "admin_console"
};

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "Hub" },
  { href: "/xchat", label: "xChat" },
  { href: "/admin/access-requests", label: "Access" },
  { href: "/admin/personas", label: "Personas" },
  { href: "/admin/batch", label: "Batch Ops" },
  { href: "/admin/portfolios", label: "Portfolios" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/rag-files", label: "RAG collections" },
  { href: "/admin/api-docs", label: "API Docs" },
  { href: "/admin/user-settings", label: "Users" },
  { href: "/admin/audit", label: "Audit" }
];

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  const mongoConnection = getMongoConnectionLabel();

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <Link className="admin-topbar-brand" href="/admin">
          <AtxFinanceLogo size="sm" />
        </Link>
        <nav className="admin-topbar-nav">
          {NAV_LINKS.map((link) => (
            <Link className="admin-topbar-link" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
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
      </header>
      <main className="admin-layout-content">{children}</main>
      <GlobalFooter />
    </div>
  );
}
