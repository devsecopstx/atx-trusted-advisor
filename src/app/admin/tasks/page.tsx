import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

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
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Scheduler Tasks</h1>
        <p className="hero-copy">
          Create and run scheduler tasks with quick controls optimized for mobile.
        </p>
      </section>

      <TasksConsole />
    </div>
  );
}
