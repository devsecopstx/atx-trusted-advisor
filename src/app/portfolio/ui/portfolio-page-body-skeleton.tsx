export function PortfolioPageBodySkeleton() {
  return (
    <div className="portfolio-overview portfolio-page-body-skeleton" aria-busy="true" aria-label="Loading portfolio">
      <div className="portfolio-top-band">
        <header className="portfolio-top-band__head portfolio-manage-head portfolio-manage-head--compact xf-noise-overlay">
          <span className="xchat-route-skeleton__pulse" style={{ width: "7rem", height: "0.65rem" }} />
          <span className="xchat-route-skeleton__pulse mt-3 block" style={{ width: "min(12rem, 100%)", height: "1.35rem" }} />
          <span className="xchat-route-skeleton__pulse mt-2 block" style={{ width: "min(18rem, 100%)", height: "0.6rem" }} />
          <div className="portfolio-manage-head__metrics portfolio-manage-head__metrics--inline mt-4">
            <span className="xchat-route-skeleton__pulse" style={{ width: "5.5rem", height: "3.25rem" }} />
            <span className="xchat-route-skeleton__pulse" style={{ width: "6.5rem", height: "3.25rem" }} />
            <span className="xchat-route-skeleton__pulse" style={{ width: "6.5rem", height: "3.25rem" }} />
          </div>
        </header>
        <aside className="portfolio-top-band__charts xf-noise-overlay" aria-hidden>
          <span className="xchat-route-skeleton__pulse block min-h-[7rem] w-full" />
        </aside>
      </div>
      <div className="portfolio-manage-table-card portfolio-panel mt-4">
        <span className="xchat-route-skeleton__pulse mb-3 block" style={{ width: "10rem", height: "0.85rem" }} />
        <span className="xchat-route-skeleton__pulse block min-h-[10rem] w-full" />
      </div>
    </div>
  );
}
