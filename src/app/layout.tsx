import { AppQueryProvider } from "@/app/ui/app-query-provider";
import { PwaBootstrapClient } from "@/app/ui/pwa-bootstrap-client";
import { TenantBrandingProvider } from "@/app/ui/tenant-branding-context";
import { XfThemeBootClient } from "@/app/ui/xf-theme-boot-client";
import { FullBleedBackground } from "@/components/FullBleedBackground";
import { getSessionUser } from "@/lib/auth";
import { getGa4MeasurementId } from "@/lib/env";
import {
    getCoreUserXfUiThemePreferenceForHexCached,
    getTenantShellBrandingForHexCached,
    getTenantXfUiThemePreferenceForHexCached
} from "@/lib/identity-shell-cache";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import type { XfUiThemePreference } from "@/lib/xf-ui-theme";
import { ObjectId } from "mongodb";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import "../../atx-docs/design-system/atxfinance-brand-kit.css";
import "./globals.css";
import { Ga4Analytics } from "./ui/ga4-analytics";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fintech-advisor.ai"),
  title: "aTx Trusted Advisory",
  description:
    `aTx⚡Finance — Powered by xAI. No Atoms Moved. Just Gains Earned. Options workspace, xChat, and portfolio tools. ${EDUCATIONAL_ONLY_SHORT}`,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "aTx Advisor"
  },
  icons: {
    icon: "/pwa/atx-logo-512.png",
    shortcut: "/pwa/atx-logo-512.png",
    apple: "/pwa/atx-logo-512.png"
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
  const ga4MeasurementId = getGa4MeasurementId();
  let tenantDefaultTheme: XfUiThemePreference | undefined;
  let userUiTheme: XfUiThemePreference | undefined;
  let tenantShellBranding: Awaited<ReturnType<typeof getTenantShellBrandingForHexCached>> = null;
  if (session?.tenantId && ObjectId.isValid(session.tenantId)) {
    [tenantDefaultTheme, tenantShellBranding] = await Promise.all([
      getTenantXfUiThemePreferenceForHexCached(session.tenantId),
      getTenantShellBrandingForHexCached(session.tenantId)
    ]);
  }
  if (session?.userId && ObjectId.isValid(session.userId)) {
    userUiTheme = await getCoreUserXfUiThemePreferenceForHexCached(session.userId);
  }

  const tenantAccentTrimmed = tenantShellBranding?.accentColor?.trim();
  const tenantAccentCssVar: CSSProperties | undefined = tenantAccentTrimmed
    ? {
        ["--xf-tenant-accent" as string]: tenantAccentTrimmed,
        ["--xf-tenant-primary" as string]: tenantAccentTrimmed,
        ["--xf-tenant-secondary" as string]: `color-mix(in srgb, ${tenantAccentTrimmed} 58%, var(--xf-text-300))`
      }
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
        <meta content="aTx Advisor" name="apple-mobile-web-app-title" />
        <link href="/manifest.webmanifest" rel="manifest" />
        <link href="/pwa/atx-logo-512.png" rel="apple-touch-icon" />
      </head>
      <body>
        <FullBleedBackground />
        <AppQueryProvider>
          <TenantBrandingProvider value={tenantShellBranding}>
            {ga4MeasurementId ? <Ga4Analytics measurementId={ga4MeasurementId} /> : null}
            <XfThemeBootClient tenantDefaultTheme={tenantDefaultTheme} userTheme={userUiTheme} />
            <PwaBootstrapClient />
            {children}
          </TenantBrandingProvider>
        </AppQueryProvider>
      </body>
    </html>
  );
}
