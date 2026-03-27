import Link from "next/link";

import { XoptionsDeckGate } from "@/app/app_user/xoptions/xoptions-deck-gate";
import Hero from "@/app/ui/pitch-hero";

/**
 * xoptions pitch deck — public app_user surface.
 * Styling uses the repo Tailwind pipeline (see tailwind / PostCSS); no CDN script required in App Router.
 */
export default function XoptionsPitchPage() {
  return (
    <XoptionsDeckGate>
      <div className="flex min-h-dvh flex-col">
        <Hero title="xoptions" />
        <div className="border-t border-emerald-500/15 bg-gray-950/90 px-6 py-5 text-center">
          <Link
            href="/app_user/xoptions/follow-up"
            className="inline-flex items-center gap-2 text-sm sm:text-base font-medium text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline"
          >
            Follow-up: meeting questions &amp; capture
            <span aria-hidden>→</span>
          </Link>
          <p className="mt-2 text-xs text-gray-500 max-w-xl mx-auto">
            Second page — checklist + notes for HNWI / family office validation.
          </p>
        </div>
      </div>
    </XoptionsDeckGate>
  );
}
