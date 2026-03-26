import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";

export const metadata: Metadata = {
  title: "xoptions · Options income, delegated",
  description:
    "Time-saving, hassle-free options workflows for HNWI and trusted-family. Powered by xAI. No atoms moved — just clear execution.",
};

type LayoutProps = {
  children: ReactNode;
};

/** Dark, full-bleed shell for the pitch deck (root layout already sets `dark` on &lt;html&gt;). */
export default function XoptionsLayout({ children }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-black text-gray-100 antialiased">
      <main>{children}</main>
      <GlobalFooter />
    </div>
  );
}
