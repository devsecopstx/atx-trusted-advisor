"use client";

import { useEffect } from "react";

import { buildCapacitorOAuthCompleteDeepLink } from "@/lib/capacitor-oauth";

function resolveSafeNextPath(raw: string | null): string {
  const next = raw?.trim() || "/xchat";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("..")) {
    return "/xchat";
  }
  return next;
}

/** Bridge page loaded in SFSafariViewController after native OAuth; returns to the app via custom URL scheme. */
export default function CapacitorOAuthDonePage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextPath = resolveSafeNextPath(params.get("next"));
    window.location.replace(buildCapacitorOAuthCompleteDeepLink(nextPath));
  }, []);

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center text-[var(--xf-text-200)]">
      <p className="text-lg font-semibold">Finishing sign-in…</p>
      <p className="mt-2 text-sm text-[var(--xf-text-400)]">Returning to aTx Advisor.</p>
    </main>
  );
}
