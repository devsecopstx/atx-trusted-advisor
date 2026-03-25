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
  title: "aTx Trusted Advisor",
  description: "Delegated options workspace — mobile-first control plane powered by xAI"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={`dark ${inter.variable}`} lang="en">
      <body>{children}</body>
    </html>
  );
}
