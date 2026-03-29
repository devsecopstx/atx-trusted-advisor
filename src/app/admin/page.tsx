import { ADMIN_FUNCTION_GROUPS } from "./ui/admin-hub-sections";

export default function AdminPage() {
  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Admin Control Center</h1>
        <p className="hero-copy">
          Navigation is now pinned in the left rail. Admin-only sections group every Hub function for faster desktop
          workflows.
        </p>
      </section>
      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Sections in rail</h2>
          <p>Use the persistent left rail to open each admin area.</p>
        </div>
        <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
          {ADMIN_FUNCTION_GROUPS.map((group) => (
            <span className="status-badge status-pending" key={group.title}>
              {group.title}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
