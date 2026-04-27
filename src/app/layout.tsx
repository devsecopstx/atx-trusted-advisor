import { PwaBootstrapClient } from "@/app/ui/pwa-bootstrap-client";
import { TenantBrandingProvider } from "@/app/ui/tenant-branding-context";
import { XfThemeBootClient } from "@/app/ui/xf-theme-boot-client";
import { getSessionUser } from "@/lib/auth";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { XfUiThemePreference } from "@/lib/xf-ui-theme";
import {
    getCoreUserXfUiThemePreferenceForHex,
    getTenantShellBrandingForHex,
    getTenantXfUiThemePreferenceForHex
} from "@/modules/identity/repository";
import { ObjectId } from "mongodb";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import "../../atx-docs/design-system/atxfinance-brand-kit.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://atxtrustedadvisory.com"),
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

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await getSessionUser();
  let tenantDefaultTheme: XfUiThemePreference | undefined;
  let userUiTheme: XfUiThemePreference | undefined;
  let tenantShellBranding: Awaited<ReturnType<typeof getTenantShellBrandingForHex>> = null;
  if (session?.tenantId && ObjectId.isValid(session.tenantId)) {
    tenantDefaultTheme = await getTenantXfUiThemePreferenceForHex(session.tenantId);
    tenantShellBranding = await getTenantShellBrandingForHex(session.tenantId);
  }
  if (session?.userId && ObjectId.isValid(session.userId)) {
    userUiTheme = await getCoreUserXfUiThemePreferenceForHex(session.userId);
  }

  const tenantAccentTrimmed = tenantShellBranding?.accentColor?.trim();
  const tenantAccentCssVar: CSSProperties | undefined = tenantAccentTrimmed
    ? { ["--xf-tenant-accent" as string]: tenantAccentTrimmed }
    : undefined;

  return (
    <html
      className={`dark ${inter.variable}`}
      lang="en"
      style={tenantAccentCssVar}
      suppressHydrationWarning
    >
      <head>
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="black-translucent" name="apple-mobile-web-app-status-bar-style" />
        <meta content="aTx Finance" name="apple-mobile-web-app-title" />
        <link href="/manifest.webmanifest" rel="manifest" />
        <link href="/pwa/icon-192.png" rel="apple-touch-icon" />
      </head>
      <body>
        <TenantBrandingProvider value={tenantShellBranding}>
          <XfThemeBootClient tenantDefaultTheme={tenantDefaultTheme} userTheme={userUiTheme} />
          <PwaBootstrapClient />
          {children}
        </TenantBrandingProvider>
      </body>
    </html>
  );
}
