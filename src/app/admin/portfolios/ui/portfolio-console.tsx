"use client";

import Link from "next/link";

import { USER_PRODUCT_WHITELABEL_SUBLINE } from "@/app/ui/product-brand-constants";

import { AdminPortfoliosCrud } from "./admin-portfolios-crud";

export function PortfolioConsole() {
  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card" style={{ padding: "0.85rem 1rem" }}>
        <Link className="cta cta-primary" href="/admin/brokers">
          Manage Brokers
        </Link>
        <p className="xf-whitelabel-sub" style={{ margin: "0.4rem 0 0" }}>
          {USER_PRODUCT_WHITELABEL_SUBLINE}
        </p>
      </article>
      <AdminPortfoliosCrud />
    </section>
  );
}
