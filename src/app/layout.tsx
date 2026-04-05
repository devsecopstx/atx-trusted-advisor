import { PwaBootstrapClient } from "@/app/ui/pwa-bootstrap-client";
import { XfThemeBootClient } from "@/app/ui/xf-theme-boot-client";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { Metadata, Viewport } from "next";
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "aTx Finance"
  },
  icons: {
    icon: "/branding/aTx.png",
    shortcut: "/branding/aTx.png",
    apple: "/pwa/icon-192.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050505"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={`dark ${inter.variable}`} lang="en" suppressHydrationWarning>
      <head>
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="black-translucent" name="apple-mobile-web-app-status-bar-style" />
        <meta content="aTx Finance" name="apple-mobile-web-app-title" />
        <link href="/manifest.webmanifest" rel="manifest" />
        <link href="/pwa/icon-192.png" rel="apple-touch-icon" />
      </head>
      <body>
        <XfThemeBootClient />
        <PwaBootstrapClient />
        {children}
      </body>
    </html>
  );
}
