import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "../../design-system/atxfinance-brand-kit.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "atxfinance core admin",
  description: "Mobile-first admin control plane for atxFinance core operations"
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
