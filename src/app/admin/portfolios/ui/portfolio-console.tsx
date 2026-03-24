"use client";

import Link from "next/link";

import { AdminPortfoliosCrud } from "./admin-portfolios-crud";

export function PortfolioConsole() {
  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
          Broker holdings import
        </h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          CSV preview → account mapping → stock lots: open the <strong>Broker import</strong> hub, or jump from{" "}
          <strong>Accounts</strong> with a portfolio pre-selected (same API{" "}
          <code className="font-mono text-xs">/api/admin/import/broker</code>).
        </p>
        <Link className="cta cta-primary" href="/admin/broker-import">
          Open broker import hub
        </Link>
      </article>
      <AdminPortfoliosCrud />
    </section>
  );
}
