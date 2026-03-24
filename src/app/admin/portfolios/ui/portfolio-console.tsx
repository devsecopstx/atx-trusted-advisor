"use client";

import Link from "next/link";

import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "@/app/admin/lib/broker-import-description";

import { AdminPortfoliosCrud } from "./admin-portfolios-crud";

export function PortfolioConsole() {
  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
          Broker import
        </h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          {ADMIN_BROKER_IMPORT_DESCRIPTION}
        </p>
        <Link className="cta cta-primary" href="/admin/broker-import">
          Open broker import hub
        </Link>
      </article>
      <AdminPortfoliosCrud />
    </section>
  );
}
