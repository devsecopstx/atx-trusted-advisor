"use client";

import Link from "next/link";

import { AdminPortfoliosCrud } from "./admin-portfolios-crud";

export function PortfolioConsole() {
  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
          Broker holdings import (onboarding)
        </h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          CSV preview → account mapping → stock lots import: use{" "}
          <strong>Portfolios → Manage accounts → Broker holdings import</strong> for a chosen book, or the onboarding
          route to pick any portfolio (same API{" "}
          <code className="font-mono text-xs">/api/admin/import/broker</code>).
        </p>
        <Link className="cta cta-primary" href="/admin/onboarding">
          Open onboarding — broker import
        </Link>
      </article>
      <AdminPortfoliosCrud />
    </section>
  );
}
