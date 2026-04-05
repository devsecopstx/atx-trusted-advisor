import { XfThemeBootClient } from "@/app/ui/xf-theme-boot-client";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "../../atx-docs/design-system/atxfinance-brand-kit.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "aTx Trusted Advisory",
  description:
    `aTx⚡Finance — Powered by xAI. No Atoms Moved. Just Gains Earned. Options workspace, xChat, and portfolio tools. ${EDUCATIONAL_ONLY_SHORT}`,
  icons: {
    icon: "/branding/app-hero-icon-transparent.png",
    shortcut: "/branding/app-hero-icon-transparent.png",
    apple: "/branding/app-hero-icon-transparent.png"
  }
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={`dark ${inter.variable}`} lang="en" suppressHydrationWarning>
      <body>
        <XfThemeBootClient />
        {children}
      </body>
    </html>
  );
}
