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
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
        />
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
        <div className="admin-topbar-actions">
          <nav className="admin-topbar-nav" aria-label="Admin quick links">
            {NAV_LINKS.map((link) => (
              <Link
                aria-label={link.label}
                className="admin-topbar-icon-link"
                data-hovertip={link.label}
                href={link.href}
                key={link.href}
              >
                <span aria-hidden className="admin-topbar-icon-link__glyph">
                  {link.icon}
                </span>
              </Link>
            ))}
          </nav>
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
      <main className="admin-layout-content">{children}</main>
      <GlobalFooter />
    </div>
  );
}
