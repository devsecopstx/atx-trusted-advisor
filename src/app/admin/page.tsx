import Link from "next/link";

type AdminFunction = {
  href: string;
  icon:
    | "chat"
    | "check"
    | "user"
    | "clock"
    | "brain"
    | "book"
    | "directory"
    | "audit"
    | "portfolio"
    | "strategy"
    | "batch";
  title: string;
  description: string;
  comingSoon?: boolean;
};

const ADMIN_FUNCTIONS: AdminFunction[] = [
  {
    href: "/xchat",
    icon: "chat",
    title: "xChat",
    description: "Open the advisory chat workspace (Grok / xAI) in the same session."
  },
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
    description: "Create and edit tenant portfolios, broker metadata, and default book per user."
  },
  {
    href: "/admin/accounts",
    icon: "portfolio",
    title: "Accounts",
    description: "Pick a portfolio, then manage custodian accounts: CRUD, cash, defaults, risk & outlook."
  },
  {
    href: "/admin/broker-import",
    icon: "batch",
    title: "Broker import",
    description: "Merrill / Fidelity holdings CSV → map to core accounts (preview, apply, dry-run)."
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
    title: "RAG collections",
    description: "Read-only xAI collection inventory for this management API key."
  },
  {
    href: "/admin/batch",
    icon: "batch",
    title: "Batch Ops Dashboard",
    description: "Track xchat batch progress, failures, and completion metrics."
  },
  {
    href: "/admin/xoptions",
    icon: "strategy",
    title: "xOptions API test",
    description: "Exercise GET strategy-options expirations and option-chain reads (BFF / backend parity)."
  },
  {
    href: "/personas",
    icon: "directory",
    title: "xPersona Directory",
    description: "Read-only list of configured xPersonas."
  },
  {
    href: "/admin/audit",
    icon: "audit",
    title: "Audit Explorer",
    description: "Browse and filter change trails across users, access requests, and xPersonas."
  },
  {
    href: "/admin",
    icon: "strategy",
    title: "xStrategyBuilder",
    description: "Build and backtest portfolio strategies with AI-assisted allocation.",
    comingSoon: true
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
    case "chat":
      return (
        <svg {...commonProps}>
          <path d="M5 10.5a6.5 6.5 0 0 1 13 0v3a2.5 2.5 0 0 1-2.5 2.5h-5.2L8 19v-3H7.5A2.5 2.5 0 0 1 5 13.5v-3z" />
          <path d="M9 10.5h6M9 13.5h3.5" />
        </svg>
      );
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
    case "strategy":
      return (
        <svg {...commonProps}>
          <path d="M4 18l4-6 4 3 4-8 4 5" />
          <path d="M4 22h16" />
          <circle cx="8" cy="12" r="1.2" />
          <circle cx="16" cy="7" r="1.2" />
        </svg>
      );
    case "batch":
      return (
        <svg {...commonProps}>
          <rect x="4" y="5" width="16" height="4" rx="1.2" />
          <rect x="4" y="10.5" width="16" height="4" rx="1.2" />
          <rect x="4" y="16" width="16" height="3" rx="1.2" />
        </svg>
      );
    default: {
      const exhaustiveCheck: never = name;
      return exhaustiveCheck;
    }
  }
}

export default function AdminPage() {
  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Admin Control Center</h1>
        <p className="hero-copy">
          Pick one function at a time. Each button opens a focused mobile-friendly
          page with large controls.
        </p>
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Admin Functions</h2>
          <p>Large tap targets designed for quick mobile navigation.</p>
        </div>
        <div className="admin-function-grid">
          {ADMIN_FUNCTIONS.map((item) =>
            item.comingSoon ? (
              <article
                className="admin-function-card admin-function-card-disabled"
                key={item.title}
              >
                <span aria-hidden="true" className="admin-function-icon">
                  <AdminFunctionIcon name={item.icon} />
                </span>
                <span className="admin-function-copy">
                  <strong>{item.title} <span className="status-badge status-pending">Coming soon</span></strong>
                  <span>{item.description}</span>
                </span>
              </article>
            ) : (
              <Link className="admin-function-card" href={item.href} key={item.href}>
                <span aria-hidden="true" className="admin-function-icon">
                  <AdminFunctionIcon name={item.icon} />
                </span>
                <span className="admin-function-copy">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
              </Link>
            )
          )}
        </div>
      </section>
    </div>
  );
}
