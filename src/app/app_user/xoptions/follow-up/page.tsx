import type { Metadata } from "next";
import Link from "next/link";

import { XoptionsDeckGate } from "@/app/app_user/xoptions/xoptions-deck-gate";

import { FollowUpMeetingClient } from "./follow-up-client";

export const metadata: Metadata = {
  title: "xoptions · Follow-up questions",
  description:
    "Top questions for your next meeting — checklist and notes for HNWI / family office validation.",
};

export default function XoptionsFollowUpPage() {
  return (
    <XoptionsDeckGate>
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-emerald-500/15 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-20">
          <div className="container mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-500/90 font-semibold">
                xoptions · Pitch deck
              </p>
              <h1 className="text-lg sm:text-xl font-semibold text-white">Follow-up — meeting capture</h1>
            </div>
            <Link
              href="/app_user/xoptions"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              ← Back to pitch
            </Link>
          </div>
        </header>

        <FollowUpMeetingClient />
      </div>
    </XoptionsDeckGate>
  );
}
