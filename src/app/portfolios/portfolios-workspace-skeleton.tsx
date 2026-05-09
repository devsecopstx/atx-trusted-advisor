export function PortfoliosWorkspaceSkeleton() {
  return (
    <div
      className="xchat-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--xf-bg-900)]"
      aria-busy="true"
      aria-label="Loading portfolio workspace"
    >
      <header className="portfolios-workspace-header-skeleton sticky top-0 z-50 flex shrink-0 flex-col gap-2 border-b border-white/10 bg-[var(--xf-bg-800)] px-4 py-3 md:px-8">
        <span className="xchat-route-skeleton__pulse" style={{ width: "min(14rem, 55%)", height: "1.1rem" }} />
        <span className="xchat-route-skeleton__pulse" style={{ width: "min(10rem, 40%)", height: "0.65rem" }} />
      </header>
      <div className="portfolio-page-body xchat-body flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="portfolios-workspace-main billing-page min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            <span className="xchat-route-skeleton__pulse min-h-[12rem] w-full" />
            <span className="xchat-route-skeleton__pulse min-h-[12rem] w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
