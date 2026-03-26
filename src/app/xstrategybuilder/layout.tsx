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
      <GlobalFooter />
    </div>
  );
}
