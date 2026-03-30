import type { ReactNode } from "react";

import { AdminPortfolioChildWorkspace } from "../ui/admin-portfolio-child-workspace";

type PortfolioSegmentLayoutProps = {
  children: ReactNode;
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioSegmentLayout({ children, params }: PortfolioSegmentLayoutProps) {
  const { portfolioId } = await params;
  return (
    <div className="core-shell admin-portfolio-id-shell">
      <AdminPortfolioChildWorkspace portfolioId={portfolioId}>{children}</AdminPortfolioChildWorkspace>
    </div>
  );
}
