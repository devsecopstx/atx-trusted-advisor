import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { GlobalFooter } from "../ui/global-footer";
import { XchatHeaderBrand } from "../ui/xchat-header-brand";
import { AdminSessionPanel } from "./ui/admin-session-panel";

type AdminLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "Hub"
};

/** Slim top bar: Hub + product xChat only. Batch, RAG, tools, API docs, and audit are on the hub (`/admin`). */
const NAV_LINKS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/admin",
    label: "Hub",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M4 5h5v5H4V5Zm7 0h5v5h-5V5ZM4 12h5v3H4v-3Zm7 0h5v3h-5v-3Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    href: "/xchat",
    label: "xChat",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M4 4h12v8H7l-3 3V4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    )
  }
];

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
        <nav className="admin-topbar-nav">
          {NAV_LINKS.map((link) => (
            <Link
              aria-label={link.label}
              className="admin-topbar-icon-link"
              href={link.href}
              key={link.href}
              title={link.label}
            >
              <span aria-hidden className="admin-topbar-icon-link__glyph">
                {link.icon}
              </span>
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
