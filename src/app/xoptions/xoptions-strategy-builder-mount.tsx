"use client";

import nextDynamic from "next/dynamic";
import { Suspense } from "react";

import type { AppUserDefaultBook } from "@/lib/app-user-default-book";

const XoptionsStrategyBuilderWorkspace = nextDynamic(
  () =>
    import("./xoptions-strategy-builder-workspace").then((m) => ({
      default: m.XoptionsStrategyBuilderWorkspace
    })),
  {
    ssr: false,
    loading: () => (
      <p className="px-2 py-10 font-mono text-sm text-[var(--xf-text-muted,#94a3b8)]">Loading xOptions workspace…</p>
    )
  }
);

type XoptionsStrategyBuilderMountProps = {
  workspaceBook: AppUserDefaultBook | null;
};

export function XoptionsStrategyBuilderMount({ workspaceBook }: XoptionsStrategyBuilderMountProps) {
  return (
    <Suspense
      fallback={
        <p className="px-2 py-10 font-mono text-sm text-[var(--xf-text-muted,#94a3b8)]">Loading xOptions workspace…</p>
      }
    >
      <XoptionsStrategyBuilderWorkspace workspaceBook={workspaceBook} />
    </Suspense>
  );
}
