import type { Metadata } from "next";

import Hero from "@/app/ui/pitch-hero";

export const metadata: Metadata = {
  title: "xOptions | xFinance",
  description:
    "AI-vetted options income for HNW investors and RIAs — wheel, covered calls, and LEAP recommendations with minimal time commitment."
};

export default function XOptionsPitchPage() {
  return <Hero title="xOptions" />;
}
