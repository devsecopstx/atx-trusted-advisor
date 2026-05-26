import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Workspace rail + tenant chrome tokens (`TenantBrandingProvider` on root layout). */
import "@/app/portfolios/portfolios-dashboard.css";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

/** Layout, plans guest, workspace rail — thread/composer CSS loads with conversation mount. */
import "./xchat-shell.css";

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

/** Static chrome only; session work stays on `page.tsx` (PPR-ready when `cacheComponents` ships repo-wide). */
export default function XchatLayout({ children }: XchatLayoutProps) {
  return (
    <div className="xchat-layout-root" data-page="xchat">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
