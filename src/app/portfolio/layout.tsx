import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";

import "../xchat/xchat.css";
import "./portfolio.css";

export const metadata: Metadata = {
  title: "Portfolio"
};

type PortfolioLayoutProps = {
  children: ReactNode;
};

export default function PortfolioLayout({ children }: PortfolioLayoutProps) {
  return (
    <div className="xchat-layout-root">
      {children}
      <GlobalFooter />
    </div>
  );
}
