import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { BackIcon } from "@/app/admin/ui/crud-icons";

import { AdminSessionPanel } from "../ui/admin-session-panel";
import { XchatConsole } from "./ui/xchat-console";

export default async function AdminXchatPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden&target=xchat");
  }

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">xchat Ask</h1>
            <p className="hero-copy">
              Test xchat responses with persona selection from a focused single-purpose page.
            </p>
          </div>
          <AdminSessionPanel
            avatarUrl={session.avatarUrl}
            displayName={session.displayName}
            email={session.email}
            xUserId={session.xUserId}
            username={session.username}
          />
        </div>
      </section>

      <section className="panel">
        <Link className="cta cta-secondary" href="/admin">
          <BackIcon className="crud-icon" /> Back to admin functions
        </Link>
      </section>

      <XchatConsole />
    </main>
  );
}
