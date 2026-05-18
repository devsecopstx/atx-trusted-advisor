import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";

import "../xchat/xchat-shell.css";

export const metadata: Metadata = {
  title: "Account"
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xchat-layout-root">
      {children}
      <GlobalFooter />
    </div>
  );
}
