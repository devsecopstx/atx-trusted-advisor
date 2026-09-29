"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { FirstSessionProgress } from "@/lib/onboarding/first-session-progress";

type ProgressResponse = { data?: FirstSessionProgress };

const FirstSessionProgressContext = createContext<FirstSessionProgress | null>(null);

export function FirstSessionProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<FirstSessionProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/app-user/onboarding/progress", {
          credentials: "include",
          cache: "no-store"
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as ProgressResponse;
        if (!cancelled && payload.data && !payload.data.complete) {
          setProgress(payload.data);
        }
      } catch {
        /* rail stays quiet if progress cannot load */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FirstSessionProgressContext.Provider value={progress}>{children}</FirstSessionProgressContext.Provider>
  );
}

export function FirstSessionProgressCard({ variant = "rail" }: { variant?: "rail" | "banner" }) {
  const progress = useContext(FirstSessionProgressContext);
  if (!progress || progress.complete) {
    return null;
  }

  const next = progress.steps.find((step) => !step.done) ?? progress.steps[0];

  return (
    <aside
      aria-label="First session setup"
      className={
        variant === "banner"
          ? "mx-3 mb-2 rounded-xl border border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] bg-[var(--xf-bg-900)] px-3 py-2"
          : "mx-2 mb-2 rounded-xl border border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] px-3 py-2"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--xf-gain-green)]">
          Desk setup
        </p>
        <p className="text-xs text-[var(--xf-text-400)]">
          {progress.completedCount}/{progress.total}
        </p>
      </div>
      <ol className="mt-2 flex gap-1" aria-label="Setup progress">
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className="h-1 flex-1 rounded-full"
            style={{
              background: step.done
                ? "var(--xf-gain-green)"
                : "color-mix(in srgb, var(--xf-text-100) 16%, transparent)"
            }}
            title={step.label}
          />
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-[var(--xf-text-100)]">{next.label}</p>
      <p className="text-xs leading-snug text-[var(--xf-text-300)]">{next.detail}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="text-xs font-semibold text-[var(--xf-gain-green)] underline" href={next.href}>
          Continue
        </Link>
        <Link className="text-xs text-[var(--xf-text-400)] underline" href="/resources/onboarding-checklist">
          Full checklist
        </Link>
      </div>
    </aside>
  );
}
