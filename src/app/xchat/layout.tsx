import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_VERSION_LABEL } from "@/lib/app-version";

import "./xchat.css";

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
      <footer className="xchat-footer">
        <p className="xchat-footer-line">
          <span className="xchat-footer-version">{APP_VERSION_LABEL}</span>
          <span aria-hidden className="xchat-footer-sep">
            ·
          </span>
          <span className="xchat-footer-disclaimer">
            <strong>not financial advice</strong>, don&apos;t, sue me bro.
          </span>
        </p>
      </footer>
    </div>
  );
}
