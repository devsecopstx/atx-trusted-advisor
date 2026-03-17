import Link from "next/link";

import { getSessionUser } from "@/lib/auth";

type AdminFunction = {
  href: string;
  icon: "check" | "user" | "clock" | "brain" | "book" | "chat" | "directory" | "audit" | "portfolio";
  title: string;
  description: string;
  adminOnly?: boolean;
};

const ADMIN_FUNCTIONS: AdminFunction[] = [
  {
    href: "/admin/access-requests",
    icon: "check",
    title: "Access Requests",
    description: "Review pending access requests and submit new role requests."
  },
  {
    href: "/admin/user-settings",
    icon: "user",
    title: "User Settings",
    description: "Upsert default account, portfolio, and notification settings."
  },
  {
    href: "/admin/portfolios",
    icon: "portfolio",
    title: "Portfolios",
    description: "View default portfolio, linked accounts, and watchlist."
  },
  {
    href: "/admin/tasks",
    icon: "clock",
    title: "Scheduler Tasks",
    description: "Create scheduled tasks, run jobs manually, and monitor status."
  },
  {
    href: "/admin/personas",
    icon: "brain",
    title: "xPersona Config",
    description: "Create and manage xchat personas and default scope presets."
  },
  {
    href: "/admin/rag-files",
    icon: "book",
    title: "RAG Uploads",
    description: "Upload and review RAG knowledge files by scope."
  },
  {
    href: "/admin/xchat",
    icon: "chat",
    title: "xchat Ask",
    description: "Ask xchat questions with a selected persona on global scope."
  },
  {
    href: "/personas",
    icon: "directory",
    title: "xPersona Directory",
    description: "Read-only list of configured xPersonas.",
    adminOnly: false
  },
  {
    href: "/admin/audit",
    icon: "audit",
    title: "Audit Explorer",
    description: "Browse and filter change trails across users, access requests, and xPersonas."
  }
];

type IconProps = {
  name: AdminFunction["icon"];
};

function AdminFunctionIcon({ name }: IconProps) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (name) {
    case "check":
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M8 12.5l2.5 2.5L16 9.5" />
        </svg>
      );
    case "user":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 18.5c1.3-2.8 3.7-4.2 6.5-4.2s5.2 1.4 6.5 4.2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8.5v4l2.7 1.6" />
        </svg>
      );
    case "brain":
      return (
        <svg {...commonProps}>
          <path d="M9 6.5A2.5 2.5 0 0 1 13.2 5a2.4 2.4 0 0 1 3.8 2.2 2.4 2.4 0 0 1 1.8 3.4 2.6 2.6 0 0 1-1.2 4.7 2.4 2.4 0 0 1-2.4 2.4H9a3 3 0 0 1-3-3V9.3a2.8 2.8 0 0 1 3-2.8z" />
          <path d="M10.4 9.2v6.6M13.8 8.5v7.1" />
        </svg>
      );
    case "book":
      return (
        <svg {...commonProps}>
          <path d="M6 5.5h10.5a2 2 0 0 1 2 2V18H8a2 2 0 0 0-2 2z" />
          <path d="M6 5.5v14.5a2 2 0 0 1 2-2h10.5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...commonProps}>
          <path d="M5.5 7.2A2.7 2.7 0 0 1 8.2 4.5h7.6a2.7 2.7 0 0 1 2.7 2.7v5.2a2.7 2.7 0 0 1-2.7 2.7h-4.3L8 18v-2.9H8.2a2.7 2.7 0 0 1-2.7-2.7z" />
        </svg>
      );
    case "directory":
      return (
        <svg {...commonProps}>
          <path d="M5 7.5h5l1.4 1.8H19a1.5 1.5 0 0 1 1.5 1.5v6.7A1.5 1.5 0 0 1 19 19H5A1.5 1.5 0 0 1 3.5 17.5V9A1.5 1.5 0 0 1 5 7.5z" />
          <path d="M8.2 13h7.6" />
        </svg>
      );
    case "portfolio":
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M4 10h16" />
          <path d="M8 6V4" />
          <path d="M16 6V4" />
        </svg>
      );
    case "audit":
      return (
        <svg {...commonProps}>
          <path d="M12 4.5v7" />
          <path d="M12 15.3v.2" />
          <path d="M7.5 5.8A8 8 0 1 0 20 12" />
          <path d="M7.3 2.8v3h3" />
        </svg>
      );
    default: {
      const exhaustiveCheck: never = name;
      return exhaustiveCheck;
    }
  }
}

type AdminPageProps = {
  searchParams: Promise<{
    error?: string;
    target?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const session = await getSessionUser();
  const isAdmin = session?.roles.includes("global_admin") ?? false;
  const showForbiddenNotice = params.error === "forbidden";
  const forbiddenTarget = params.target?.trim().toLowerCase();
  const forbiddenTargetLabel =
    forbiddenTarget === "personas"
      ? "xPersona Configuration"
      : forbiddenTarget === "xchat"
        ? "xchat Ask"
        : "that function";

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">xfinance core admin</p>
        <h1 className="hero-title">Admin Control Center</h1>
        <p className="hero-copy">
          Pick one function at a time. Each button opens a focused mobile-friendly
          page with large controls.
        </p>
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
              Access denied for {forbiddenTargetLabel}. Your account is authenticated but not a global
              admin.
            </p>
          ) : null}
        </div>
        <div className="admin-function-grid">
          {ADMIN_FUNCTIONS.map((item) =>
            isAdmin || item.adminOnly === false ? (
              <Link className="admin-function-card" href={item.href} key={item.href}>
                <span aria-hidden="true" className="admin-function-icon">
                  <AdminFunctionIcon name={item.icon} />
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
                  <AdminFunctionIcon name={item.icon} />
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
    </div>
  );
}
