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
        <h1 className="hero-title">Scheduled jobs</h1>
        <p className="hero-copy">
          Manage cron schedules, manual runs, and run history for your workspace. Delivery targets live under{" "}
          <a className="underline font-medium" href="/admin/delivery-channels">
            Delivery channels
          </a>
          .
        </p>
      </section>

      <TasksConsole />
    </div>
  );
}
