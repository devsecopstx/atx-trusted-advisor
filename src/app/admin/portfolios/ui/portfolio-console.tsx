"use client";

import Link from "next/link";


import { AdminPortfoliosCrud } from "./admin-portfolios-crud";

export function PortfolioConsole() {
  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card" style={{ padding: "0.85rem 1rem" }}>
        <Link className="cta cta-primary" href="/admin/brokers">
          Manage Brokers
        </Link>
      </article>
      <AdminPortfoliosCrud />
    </section>
  );
}
