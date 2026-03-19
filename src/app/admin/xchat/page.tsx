import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { XchatConsole } from "./ui/xchat-console";

export default async function AdminXchatPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">xchat Ask</h1>
        <p className="hero-copy">
          Test xchat responses with persona selection from a focused single-purpose page.
        </p>
      </section>

      <XchatConsole />

      <section className="panel stack-gap">
        <Link className="admin-function-card" href="/admin/xchat/batch">
          <span className="admin-function-copy">
            <strong>Open Batch Ops Dashboard</strong>
            <span>View active jobs, failures, and progress summary.</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
