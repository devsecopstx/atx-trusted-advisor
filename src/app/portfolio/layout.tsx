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
      <GlobalFooter
        subline={
          <>
            aTx⚡Finance · Portfolio tracking (cost basis)
            <span aria-hidden className="app-footer-sep">
              {" "}
              |{" "}
            </span>
            <strong>Not financial advice</strong> — illustrative book values only; not live market marks.
          </>
        }
      />
    </div>
  );
}
