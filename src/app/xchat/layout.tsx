import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/portfolios/portfolios-dashboard.css";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

import { GlobalFooter } from "../ui/global-footer";

import "./xchat.css";

/** Avoid stale RSC/HTML at CDN/LB after deploys; footer embeds APP_VERSION. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "xChat",
  description: `xChat for market education and research workflows. ${EDUCATIONAL_ONLY_SHORT}`,
  alternates: {
    canonical: "/xchat"
  }
};

type XchatLayoutProps = {
  children: ReactNode;
};

export default function XchatLayout({ children }: XchatLayoutProps) {
  return (
    <div className="xchat-layout-root xchat-layout-root--safe">
      {children}
      <GlobalFooter />
    </div>
  );
}
