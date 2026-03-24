import { StrategyOptionsConsole } from "@/app/xstrategybuilder/strategy-options/strategy-options-console";

export default function AdminXoptionsPage() {
  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">admin_console · xOptions</p>
        <h1 className="hero-title">Strategy options API test</h1>
        <p className="hero-copy">
          Read-only GET harness for Yahoo-backed{" "}
          <code className="xsb-inline-code">/api/strategy-options/expirations</code> and{" "}
          <code className="xsb-inline-code">/api/strategy-options</code>. There is no create/update/delete
          surface for this feed—use this page to verify BFF ↔ backend parity and payloads.
        </p>
      </section>
      <StrategyOptionsConsole
        backHref="/admin"
        backLabel="Back to admin hub"
        eyebrow="admin · xOptions (strategy-options)"
      />
    </div>
  );
}
