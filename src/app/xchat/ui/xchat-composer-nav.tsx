"use client";

import Link from "next/link";

import { LucideMonitorIcon, XoptionsRocketIcon } from "@/app/ui/lucide-product-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

type XchatComposerNavProps = {
  /** Guest shell: tooltips note that sign-in may be required. */
  variant?: "default" | "guest";
};

export function XchatComposerNav({ variant = "default" }: XchatComposerNavProps) {
  const guest = variant === "guest";
  return (
    <nav aria-label="Workspace" className="xchat-composer-nav">
      <XfHoverHint
        hint={guest ? "Books overview — sign in may be required" : "Books overview — desk, holdings, import"}
      >
        <Link className="xchat-composer-nav__link" href="/portfolios">
          <LucideMonitorIcon className="xchat-composer-nav__icon" />
          <span>Books Overview</span>
        </Link>
      </XfHoverHint>
      <XfHoverHint hint={guest ? "Open watchlist — sign in may be required" : "Open watchlist"}>
        <Link className="xchat-composer-nav__link" href="/watchlist">
          <svg aria-hidden className="xchat-composer-nav__icon" fill="none" viewBox="0 0 20 20">
            <path
              d="M10 3l2.1 4.26L17 8l-3.5 3.4.83 4.86L10 14.2 5.67 16.26l.83-4.86L3 8l4.9-.74L10 3Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.4"
            />
          </svg>
          <span>myWatchlist</span>
        </Link>
      </XfHoverHint>
      <XfHoverHint
        hint={guest ? "Open xOptions — sign in may be required" : "Open xOptions — chains and strategy tools"}
      >
        <Link className="xchat-composer-nav__link" href="/xoptions">
          <XoptionsRocketIcon className="xchat-composer-nav__icon" />
          <span>xOptions</span>
        </Link>
      </XfHoverHint>
    </nav>
  );
}
