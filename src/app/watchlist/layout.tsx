import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/portfolios/portfolios-dashboard.css";
import "../xchat/xchat.css";
import "./watchlist.css";

export const metadata: Metadata = {
  title: "Watchlist"
};

type WatchlistLayoutProps = {
  children: ReactNode;
};

/** Viewport lock: rail `h-full` + main column scroll + footer pinned need a definite height chain. */
export default function WatchlistLayout({ children }: WatchlistLayoutProps) {
  return (
    <div className="xchat-layout-root">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
