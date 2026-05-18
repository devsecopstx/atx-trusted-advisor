"use client";

import { useWorkspacePulse } from "@/lib/react-query/use-workspace-pulse";

export function PortfoliosMarketsNewsCard() {
  const pulseQuery = useWorkspacePulse("");
  const lines = (pulseQuery.data?.news ?? []).slice(0, 4).map((n) => ({ title: n.title, link: n.link }));
  const busy = pulseQuery.isLoading || pulseQuery.isFetching;

  return (
    <section
      className="portfolios-markets-news-card xf-noise-overlay mt-3 rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3"
      aria-label="Markets and news"
    >
      <h2 className="portfolios-markets-news-card__title m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]">
        Markets &amp; news
      </h2>
      {busy && lines.length === 0 ? (
        <p className="portfolios-markets-news-card__muted m-0 mt-2 text-xs">Loading…</p>
      ) : null}
      {!busy && lines.length === 0 ? (
        <p className="portfolios-markets-news-card__muted m-0 mt-2 text-xs">No headlines.</p>
      ) : null}
      {lines.length > 0 ? (
        <ul className="portfolios-markets-news-card__list m-0 mt-2 list-none space-y-1.5 p-0">
          {lines.map((n) => (
            <li key={n.link} className="text-[0.7rem] leading-snug">
              <a
                className="portfolios-markets-news-card__link text-[var(--xf-text-200)] underline decoration-transparent underline-offset-2 transition-colors hover:text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] hover:decoration-current"
                href={n.link}
                rel="noopener noreferrer"
                target="_blank"
              >
                {n.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
