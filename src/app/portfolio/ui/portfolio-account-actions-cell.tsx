"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddIcon, DeleteIcon } from "@/app/admin/ui/crud-icons";
import { IconEditLink } from "@/app/ui/icon-edit-control";

type Props = {
  portfolioIdHex: string;
  accountIdHex: string;
  accountName: string;
  totalAccounts: number;
  focusAccountId: string;
  onFocusChange: (accountIdHex: string) => void;
};

export function PortfolioAccountActionsCell({
  portfolioIdHex,
  accountIdHex,
  accountName,
  totalAccounts,
  focusAccountId,
  onFocusChange
}: Props) {
  const router = useRouter();
  const [deletePending, setDeletePending] = useState(false);
  const canDelete = totalAccounts > 1;

  async function onDelete() {
    if (!canDelete) return;
    if (
      !window.confirm(
        `Delete account "${accountName}"? This removes its positions. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletePending(true);
    try {
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioIdHex)}/accounts/${encodeURIComponent(accountIdHex)}`,
        { method: "DELETE", credentials: "include" }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? "Could not delete account.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Delete failed. Check your connection and try again.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="portfolio-account-actions" role="group" aria-label={`Actions for ${accountName}`}>
      <label className="portfolio-account-actions__focus" title="Focus account for the toolbar above">
        <input
          type="radio"
          name="portfolio-account-focus"
          className="portfolio-account-actions__radio"
          checked={focusAccountId === accountIdHex}
          onChange={() => onFocusChange(accountIdHex)}
          aria-label={`Select ${accountName} as focus`}
        />
        <span className="portfolio-account-actions__focus-label">Select</span>
      </label>
      <IconEditLink
        href={`/portfolio/accounts/${accountIdHex}`}
        label={`Edit ${accountName}`}
        variant="tiny"
      />
      {canDelete ? (
        <button
          type="button"
          className="portfolio-account-actions__icon-btn"
          disabled={deletePending}
          title="Delete account"
          aria-label={`Delete ${accountName}`}
          onClick={() => void onDelete()}
        >
          <DeleteIcon className="crud-icon" aria-hidden />
        </button>
      ) : null}
      <Link
        className="portfolio-account-actions__add-holdings"
        href={`/portfolio/accounts/${encodeURIComponent(accountIdHex)}/add-holdings`}
        title="Add positions to this account"
      >
        <AddIcon className="crud-icon" aria-hidden />
        <span>Add holdings</span>
      </Link>
    </div>
  );
}
