import type { Metadata } from "next";
import type { ReactNode } from "react";

import { EducationalDisclaimerBanner } from "@/app/ui/educational-disclaimer-banner";
import { GlobalFooter } from "@/app/ui/global-footer";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

import "../xchat/xchat.css";
import "./xoptions.css";

export const metadata: Metadata = {
  title: "xOptions",
  description: `xOptions strategy workspace for educational analysis only. ${EDUCATIONAL_ONLY_SHORT}`,
  openGraph: {
    title: "xOptions · aTx Finance",
    description: `Options income and strategy analysis. ${EDUCATIONAL_ONLY_SHORT}`,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "xOptions · aTx Finance",
    description: `Options strategy workspace. ${EDUCATIONAL_ONLY_SHORT}`
  }
};

type Props = {
  children: ReactNode;
};

export default function XoptionsLayout({ children }: Props) {
  return (
    <div className="xchat-layout-root min-h-dvh bg-[color:var(--xf-xoptions-surface)] text-[color:var(--xf-text-100)]">
      <EducationalDisclaimerBanner className="mx-4 md:mx-8" />
      {children}
      <GlobalFooter />
    </div>
  );
}
