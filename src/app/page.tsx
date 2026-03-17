import { XFinanceLogo } from "./ui/xfinance-logo";

type ApiSurface = {
  path: string;
  method: string;
  useCase: string;
};

const adminSurfaces: ApiSurface[] = [
  {
    path: "/api/health",
    method: "GET",
    useCase: "Service liveness and deployment health checks"
  },
  {
    path: "/api/admin/access-requests",
    method: "GET/POST",
    useCase: "Review and create user access requests"
  },
  {
    path: "/api/admin/tasks",
    method: "GET/POST",
    useCase: "Manage scheduled operational tasks"
  },
  {
    path: "/api/admin/users/:userId/settings",
    method: "GET/PUT",
    useCase: "Upsert broker, portfolio, and notification defaults"
  }
];

function getOAuthStatus(): "configured" | "missing" {
  const hasClientId = Boolean(process.env.X_OAUTH_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.X_OAUTH_CLIENT_SECRET);
  return hasClientId && hasClientSecret ? "configured" : "missing";
}

export default function HomePage() {
  const oauthStatus = getOAuthStatus();

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <XFinanceLogo size="md" showSubtitle />
            <h1 className="hero-title">Admin Control Center</h1>
            <p className="hero-copy">
              Mobile-first operations surface for access governance, task scheduling,
              and portfolio administration.
            </p>
          </div>
          <div className="badge-wrap">
            <span className="status-badge status-live">API live</span>
            <span
              className={`status-badge ${oauthStatus === "configured" ? "status-ready" : "status-warn"}`}
            >
              X OAuth {oauthStatus}
            </span>
          </div>
        </div>

        <div className="cta-row">
          <a className="cta cta-primary" href="/login">
            Login with X
          </a>
          <a className="cta cta-secondary" href="/admin">
            Open admin console
          </a>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Admin API surfaces</h2>
          <p>Current MVP endpoints available to core operators.</p>
        </header>

        <div className="surface-grid">
          {adminSurfaces.map((surface) => (
            <article key={surface.path} className="surface-card xf-widget">
              <p className="chip">{surface.method}</p>
              <h3>{surface.path}</h3>
              <p>{surface.useCase}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
