import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "xchat — xFinance"
};

type XchatLayoutProps = {
  children: ReactNode;
};

export default function XchatLayout({ children }: XchatLayoutProps) {
  return <>{children}</>;
}
