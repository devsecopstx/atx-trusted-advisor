import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Rail + desk chrome (import before route CSS so composer/thread rules paint earlier). */
import "@/app/portfolios/portfolios-dashboard.css";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

/** xChat composer, thread, and workspace rail surfaces. */
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
    <div className="xchat-layout-root">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
