"use client";

import Link from "next/link";

import { AppUserWorkspaceAccountPicker } from "@/app/ui/app-user-workspace-account-picker";
import { AppUserWorkspacePortfolioPicker } from "@/app/ui/app-user-workspace-portfolio-picker";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";

type WorkspacePortfolioAccountPickerCardProps = {
  book: AppUserDefaultBook | null;
};

export function WorkspacePortfolioAccountPickerCard({ book }: WorkspacePortfolioAccountPickerCardProps) {
  if (!book) {
    return (
      <p className="app-user-rail-workspace-hint">
        myPortfolios isn&apos;t available yet.{" "}
        <Link className="app-user-rail-workspace-hint-link" href="/portfolios">
          Portfolios
        </Link>{" "}
        to add one.
      </p>
    );
  }

  return (
    <div className="app-user-rail-workspace-card">
      <AppUserWorkspacePortfolioPicker
        portfolios={book.workspacePortfolios}
        selectedPortfolioId={book.portfolioId}
      />
      <AppUserWorkspaceAccountPicker
        accounts={book.accounts}
        portfolioId={book.portfolioId}
        serverDefaultAccountId={book.accountId}
      />
    </div>
  );
}
