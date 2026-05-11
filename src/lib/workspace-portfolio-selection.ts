export const WORKSPACE_PORTFOLIO_CHANGED_EVENT = "xf-workspace-portfolio-changed";

export type WorkspacePortfolioChangedDetail = {
  portfolioId: string;
};

export function dispatchWorkspacePortfolioChanged(detail: WorkspacePortfolioChangedDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(WORKSPACE_PORTFOLIO_CHANGED_EVENT, { detail }));
}
