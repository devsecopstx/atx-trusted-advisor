import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "xoptions · Options income, delegated",
  description:
    "Time-saving, hassle-free options workflows for HNWI and RIAs. Powered by xAI. No atoms moved — just clear execution.",
};

type LayoutProps = {
  children: ReactNode;
};

/** Dark, full-bleed shell for the pitch deck (root layout already sets `dark` on &lt;html&gt;). */
export default function XoptionsLayout({ children }: LayoutProps) {
  return (
    <main className="min-h-dvh bg-black text-gray-100 antialiased">
      {children}
    </main>
  );
}
