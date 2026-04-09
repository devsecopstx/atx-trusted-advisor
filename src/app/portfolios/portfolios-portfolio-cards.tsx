"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import { PortfoliosPortfolioCardItem } from "./portfolios-portfolio-card-item";

const PortfoliosPortfolioCardItemLazy = dynamic(
  () =>
    import("./portfolios-portfolio-card-item").then((m) => ({ default: m.PortfoliosPortfolioCardItem })),
  { ssr: false, loading: () => <PortfoliosPortfolioCardSkeleton /> }
);

function PortfoliosPortfolioCardSkeleton() {
  return (
    <div
      className="portfolios-portfolio-cards__card w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-3"
      style={{ minHeight: "8.75rem", background: "color-mix(in srgb, var(--xf-text-100) 5%, transparent)" }}
    />
  );
}

const PORTFOLIO_CARD_ROW_EST_PX = 148;

type Props = {
  initialRows: WorkspacePortfolioRow[];
  accountSlices: WorkspaceDashboardAccountSlice[];
};

export function PortfoliosPortfolioCards({ initialRows, accountSlices }: Props) {
  const router = useRouter();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = initialRows.length > 15;

  const rowVirtualizer = useVirtualizer({
    count: initialRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PORTFOLIO_CARD_ROW_EST_PX,
    overscan: 4
  });

  const openBook = useCallback(
    async (portfolioId: string) => {
      setOpeningId(portfolioId);
      try {
        const res = await fetch("/api/user/workspace-portfolio", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioId })
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          window.alert(body.error ?? "Could not open portfolio");
          return;
        }
        router.push("/portfolio");
      } finally {
        setOpeningId(null);
      }
    },
    [router]
  );

  if (initialRows.length === 0) {
    return (
      <p className="portfolios-workspace-card-muted text-sm text-[var(--xf-text-300)]">
        No portfolios yet. Use <strong className="text-[var(--xf-text-200)]">New portfolio</strong> below.
      </p>
    );
  }

  if (!virtualize) {
    return (
      <ul className="portfolios-portfolio-cards flex list-none flex-col gap-3 p-0 m-0" role="list">
        {initialRows.map((row) => (
          <li key={row.id}>
            <PortfoliosPortfolioCardItem
              accountSlices={accountSlices}
              opening={openingId === row.id}
              row={row}
              onOpen={openBook}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="portfolios-portfolio-cards portfolios-portfolio-cards--virtual min-w-0"
      role="list"
      style={{
        maxHeight: "min(70vh, 32rem)",
        overflow: "auto",
        position: "relative"
      }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
          width: "100%"
        }}
      >
        {rowVirtualizer.getVirtualItems().map((vi) => {
          const row = initialRows[vi.index]!;
          return (
            <div
              key={row.id}
              className="portfolios-portfolio-cards__virtual-row"
              role="listitem"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                minHeight: vi.size,
                transform: `translateY(${vi.start}px)`,
                paddingBottom: "0.75rem"
              }}
            >
              <PortfoliosPortfolioCardItemLazy
                accountSlices={accountSlices}
                opening={openingId === row.id}
                row={row}
                onOpen={openBook}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
