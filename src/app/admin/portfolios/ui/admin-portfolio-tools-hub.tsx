"use client";

import Link from "next/link";

import { getPortfolioChildToolLinks } from "./portfolio-child-tools";
import { PortfolioManageNav } from "./portfolio-manage-nav";

type AdminPortfolioToolsHubProps = {
  portfolioId: string;
};

export function AdminPortfolioToolsHub({ portfolioId }: AdminPortfolioToolsHubProps) {
  const links = getPortfolioChildToolLinks(portfolioId);
  return (
    <section className="panel stack-gap">
      <PortfolioManageNav portfolioId={portfolioId} active="tools" />
      <article className="surface-card xf-widget section-card">
        <p className="eyebrow">Portfolio book</p>
        <h2 className="hero-title" style={{ fontSize: "1.25rem", marginBottom: "0.35rem" }}>
          Child tools
        </h2>
        <p className="status-text" style={{ marginBottom: "1rem" }}>
          Open a tool below. Switch books from the left rail; your current section is preserved.
        </p>
        <ul className="admin-portfolio-tools-hub-grid">
          {links.map((action) => (
            <li key={action.path}>
              <Link className="admin-portfolio-child-link" href={action.path} title={action.title}>
                <span className="admin-portfolio-child-link__label">{action.label}</span>
                <span className="admin-portfolio-child-link__type">{action.typeLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
