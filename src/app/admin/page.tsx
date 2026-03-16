import { redirect } from "next/navigation";
import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel } from "@/lib/env";

import { AdminSessionPanel } from "./ui/admin-session-panel";

type AdminFunction = {
  href: string;
  icon: string;
  title: string;
  description: string;
  adminOnly?: boolean;
};

const ADMIN_FUNCTIONS: AdminFunction[] = [
  {
    href: "/admin/access-requests",
    icon: "✅",
    title: "Access Requests",
    description: "Review pending access requests and submit new role requests."
  },
  {
    href: "/admin/user-settings",
    icon: "👤",
    title: "User Settings",
    description: "Upsert default account, portfolio, and notification settings."
  },
  {
    href: "/admin/tasks",
    icon: "⏱️",
    title: "Scheduler Tasks",
    description: "Create scheduled tasks, run jobs manually, and monitor status."
  },
  {
    href: "/admin/personas",
    icon: "🧠",
    title: "xPersona Config",
    description: "Create and manage xchat personas and default scope presets."
  },
  {
    href: "/admin/rag-files",
    icon: "📚",
    title: "RAG Uploads",
    description: "Upload and review RAG knowledge files by scope."
  },
  {
    href: "/admin/xchat",
    icon: "💬",
    title: "xchat Ask",
    description: "Ask xchat questions with a selected persona on global scope."
  },
  {
    href: "/personas",
    icon: "📖",
    title: "xPersona Directory",
    description: "Read-only list of configured xPersonas.",
    adminOnly: false
  }
];

type AdminPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  const mongoConnection = getMongoConnectionLabel();
  const isAdmin = session.roles.includes("global_admin");
  const showForbiddenNotice = params.error === "forbidden";

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">xFinance Core</h1>
            <p className="hero-copy">
              Pick one function at a time. Each button opens a focused mobile-friendly
              page with large controls.
            </p>
          </div>
          <AdminSessionPanel
            avatarUrl={session.avatarUrl}
            displayName={session.displayName}
            email={session.email}
            mongoConnection={mongoConnection}
            xUserId={session.xUserId}
            username={session.username}
          />
        </div>
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Admin Functions</h2>
          <p>
            {isAdmin
              ? "Large tap targets designed for quick mobile navigation."
              : "Authenticated. Admin functions are visible but locked for non-admin users."}
          </p>
          {showForbiddenNotice ? (
            <p className="status-text status-error">
              Access denied for that function. Your account is authenticated but not a global admin.
            </p>
          ) : null}
        </div>
        <div className="admin-function-grid">
          {ADMIN_FUNCTIONS.map((item) =>
            isAdmin || item.adminOnly === false ? (
              <Link className="admin-function-card" href={item.href} key={item.href}>
                <span aria-hidden="true" className="admin-function-icon">
                  {item.icon}
                </span>
                <span className="admin-function-copy">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
              </Link>
            ) : (
              <article
                className="admin-function-card admin-function-card-disabled"
                key={item.href}
              >
                <span aria-hidden="true" className="admin-function-icon">
                  {item.icon}
                </span>
                <span className="admin-function-copy">
                  <strong>
                    {item.title} (locked)
                  </strong>
                  <span>Request global admin role to access this function.</span>
                </span>
              </article>
            )
          )}
        </div>
      </section>
    </main>
  );
}
