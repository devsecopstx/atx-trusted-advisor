"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AppUserWorkspacePortfolioRef } from "@/lib/app-user-default-book";
import { dispatchWorkspacePortfolioChanged } from "@/lib/workspace-portfolio-selection";

type AppUserWorkspacePortfolioPickerProps = {
  portfolios: AppUserWorkspacePortfolioRef[];
  selectedPortfolioId: string;
};

export function AppUserWorkspacePortfolioPicker({
  portfolios,
  selectedPortfolioId
}: AppUserWorkspacePortfolioPickerProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function switchPortfolio(portfolioId: string) {
    if (portfolioId === selectedPortfolioId) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/user/workspace-portfolio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? "Could not switch portfolio");
        return;
      }
      dispatchWorkspacePortfolioChanged({ portfolioId });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (portfolios.length <= 1) {
    const only = portfolios[0];
    return (
      <div className="app-user-rail-workspace-row">
        <span className="app-user-rail-workspace-k">Portfolio</span>
        <span className="app-user-rail-workspace-v" title="Active workspace portfolio">
          {only?.name ?? "Portfolio"}
        </span>
      </div>
    );
  }

  return (
    <div className="app-user-rail-workspace-row app-user-rail-workspace-row--stack">
      <span className="app-user-rail-workspace-k" id="workspace-portfolio-lbl">
        Portfolio
      </span>
      <select
        aria-labelledby="workspace-portfolio-lbl"
        className="app-user-rail-account-select"
        disabled={pending}
        value={selectedPortfolioId}
        onChange={(e) => void switchPortfolio(e.target.value)}
      >
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
