import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "../ui/global-footer";

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
      <GlobalFooter
        subline={
          <>
            Powered by xAI · aTx⚡Finance · Finance Advisory
            <span aria-hidden className="app-footer-sep">
              {" "}
              |{" "}
            </span>
            <strong>Not financial advice</strong> — consult a licensed professional for personal
            guidance.
          </>
        }
      />
    </div>
  );
}
