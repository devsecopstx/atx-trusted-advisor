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
          Create and run tenant-level scheduler jobs (cron / RRULE). Use <strong>Jobs</strong> to edit and run,{" "}
          <strong>Add job</strong> for new schedules, and{" "}
          <a className="underline font-medium" href="/admin/delivery-channels">
            Delivery channels
          </a>{" "}
          for Slack/email targets.
        </p>
      </section>

      <TasksConsole />
    </div>
  );
}
