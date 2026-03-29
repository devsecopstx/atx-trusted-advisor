import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "../ui/global-footer";

import "./xchat.css";

/** Avoid stale RSC/HTML at CDN/LB after deploys; footer embeds APP_VERSION. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "xChat"
};

type XchatLayoutProps = {
  children: ReactNode;
};

export default function XchatLayout({ children }: XchatLayoutProps) {
  return (
    <div className="xchat-layout-root">
      {children}
      <GlobalFooter />
    </div>
  );
}
