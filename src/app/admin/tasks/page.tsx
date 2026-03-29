import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { TasksConsole } from "./ui/tasks-console";

export default async function AdminTasksPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Scheduler Jobs</h1>
        <p className="hero-copy">
          Create and run predefined scheduler jobs with robust cron controls.
        </p>
      </section>

      <TasksConsole />
    </div>
  );
}
