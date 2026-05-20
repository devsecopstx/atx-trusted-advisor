import type { Metadata } from "next";
import type { ReactNode } from "react";

import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

/** Workspace rail (`WorkspaceProductSidebar`) — same glyph/sidebar rules as xChat layout */
import "@/app/portfolios/portfolios-dashboard.css";
import "../xchat/xchat-shell.css";
import "./xoptions.css";

export const metadata: Metadata = {
  title: "xOptions",
  description: `xOptions strategy workspace for educational analysis only. ${EDUCATIONAL_ONLY_SHORT}`,
  openGraph: {
    title: "xOptions · aTx Advisor",
    description: `Options income and strategy analysis. ${EDUCATIONAL_ONLY_SHORT}`,
    type: "website",
    images: [
      {
        url: "/landing/xoptions.png",
        width: 1800,
        height: 1125,
        alt: "xOptions strategy builder workspace in aTx Advisor"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "xOptions · aTx Advisor",
    description: `Options strategy workspace. ${EDUCATIONAL_ONLY_SHORT}`,
    images: ["/landing/xoptions.png"]
  }
};

type Props = {
  children: ReactNode;
};

export default function XoptionsLayout({ children }: Props) {
  return (
    <div className="xchat-layout-root text-[color:var(--xf-text-100)]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
