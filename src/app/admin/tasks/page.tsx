import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AdminSessionPanel } from "../ui/admin-session-panel";
import { TasksConsole } from "./ui/tasks-console";

export default async function AdminTasksPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden");
  }

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">Scheduler Tasks</h1>
            <p className="hero-copy">
              Create and run scheduler tasks with quick controls optimized for mobile.
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
          Back to admin functions
        </Link>
      </section>

      <TasksConsole />
    </main>
  );
}
