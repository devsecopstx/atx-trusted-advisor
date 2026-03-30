import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";

import "../xchat/xchat.css";
import "./xoptions.css";

export const metadata: Metadata = {
  title: "xOptions"
};

type Props = {
  children: ReactNode;
};

export default function XoptionsLayout({ children }: Props) {
  return (
    <div className="xchat-layout-root min-h-dvh bg-[color:var(--xf-bg-900)] text-[color:var(--xf-text-100)]">
      {children}
      <GlobalFooter />
    </div>
  );
}
