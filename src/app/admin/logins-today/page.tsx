import { LoginsTodayConsole } from "./ui/logins-today-console";

export default function AdminLoginsTodayPage() {
  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Logins today</h1>
        <p className="hero-copy">
          Successful and failed attempts from <code className="xsb-inline-code">audit_login</code> since UTC midnight,
          newest first (aligned with the hub &quot;Logins today (UTC)&quot; stat).
        </p>
      </section>
      <LoginsTodayConsole />
    </div>
  );
}
