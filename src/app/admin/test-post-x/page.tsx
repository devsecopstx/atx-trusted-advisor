import { TestPostXPanel } from "./ui/test-post-x-panel";

export default function AdminTestPostXPage() {
  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">admin_console · Developer</p>
        <h1 className="hero-title">Test post to X</h1>
        <p className="hero-copy">
          Send a one-off post through the X API v2 tweet endpoint. Use <strong>Connect X for posting</strong> below
          (OAuth in browser) so the refresh token is stored sealed in Mongo — or set legacy{" "}
          <code className="xsb-inline-code">X_OAUTH_REFRESH_TOKEN</code>. Still requires{" "}
          <code className="xsb-inline-code">X_OAUTH_CLIENT_ID</code> / <code className="xsb-inline-code">X_OAUTH_CLIENT_SECRET</code>.
        </p>
      </section>
      <TestPostXPanel />
    </div>
  );
}
