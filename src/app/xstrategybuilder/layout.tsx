import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "../ui/global-footer";

import "../xchat/xchat.css";

export const metadata: Metadata = {
  title: "xStrategyBuilder"
};

type XstrategyBuilderLayoutProps = {
  children: ReactNode;
};

export default function XstrategyBuilderLayout({ children }: XstrategyBuilderLayoutProps) {
  return (
    <div className="xchat-layout-root">
      {children}
      <GlobalFooter
        subline={
          <>
            Powered by xAI · aTx⚡Finance · B2B licensing and advisory stack
            <span aria-hidden className="app-footer-sep">
              {" "}
              |{" "}
            </span>
            <strong>Not financial advice</strong> — hypothetical and backtested figures are illustrative only.
          </>
        }
      />
    </div>
  );
}
