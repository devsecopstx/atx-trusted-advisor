import type { Metadata } from "next";

import { XoptionsWeeklyReviewScreenshotMock } from "@/app/xoptions/ui/xoptions-weekly-review-mock";

export const metadata: Metadata = {
  title: "xOptions weekly review mock",
  robots: { index: false, follow: false }
};

export default function XoptionsWeeklyReviewMockPage() {
  return (
    <main className="min-h-screen bg-[var(--xf-bg-900)] px-4 py-10">
      <XoptionsWeeklyReviewScreenshotMock />
    </main>
  );
}
