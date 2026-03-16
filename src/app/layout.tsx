import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../../design-system/xfinance-brand-kit.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "xfinance core admin",
  description: "Mobile-first admin control plane for xFinance core operations"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
