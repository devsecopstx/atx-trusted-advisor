"use client";

import nextDynamic from "next/dynamic";

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

export function XoptionsStrategyBuilderMount() {
  return <XoptionsStrategyBuilderWorkspace />;
}
