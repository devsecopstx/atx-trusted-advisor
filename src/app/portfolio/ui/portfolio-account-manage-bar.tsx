"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { IconEditButton } from "@/app/ui/icon-edit-control";
import { isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import {
    buildPortfolioDeskHandoffUrls,
    buildPortfolioDeskXchatPrompt,
    writePortfolioDeskXchatHandoff
} from "@/lib/portfolio/portfolio-desk-handoff";
import {
    dispatchWorkspaceAccountChanged,
    writeStoredWorkspaceAccountId
} from "@/lib/workspace-account-selection";

export type PortfolioAccountManageOption = {
  id: string;
  name: string;
  isDefault?: boolean;
};

type Props = {
  accounts: PortfolioAccountManageOption[];
  /** When set with `onSelectedAccountIdChange`, the bar is controlled (e.g. table row radios). */
  selectedAccountId?: string;
  onSelectedAccountIdChange?: (accountId: string) => void;
  /** When set, account changes sync workspace account (rail / xOptions) and enable deep link context. */
  portfolioIdHex?: string;
  portfolioName?: string | null;
  accountPositions?: SerializablePosition[];
  focusSymbol?: string | null;
};

export function PortfolioAccountManageBar({
  accounts,
  selectedAccountId: controlledId,
  onSelectedAccountIdChange,
  portfolioIdHex,
  portfolioName = null,
  accountPositions = [],
  focusSymbol = null
}: Props) {
  const router = useRouter();
  const preferredId = useMemo(() => {
    const d = accounts.find((a) => a.isDefault);
    return d?.id ?? accounts[0]?.id ?? "";
  }, [accounts]);

  const [userSelectedId, setUserSelectedId] = useState("");

  const effectiveId = useMemo(() => {
    if (controlledId !== undefined) {
      if (controlledId && accounts.some((a) => a.id === controlledId)) {
        return controlledId;
      }
      return preferredId;
    }
    if (userSelectedId && accounts.some((a) => a.id === userSelectedId)) {
      return userSelectedId;
    }
    return preferredId;
  }, [accounts, controlledId, preferredId, userSelectedId]);

  const isControlled = controlledId !== undefined && onSelectedAccountIdChange !== undefined;

  if (accounts.length === 0) {
    return null;
  }

  function goManage() {
    if (!effectiveId) return;
    router.push(`/portfolio/accounts/${encodeURIComponent(effectiveId)}`);
  }

  const selectedAccountName = accounts.find((a) => a.id === effectiveId)?.name ?? "Selected account";

  const deskHandoff =
    portfolioIdHex &&
    effectiveId &&
    isLikelyMongoObjectIdHex(portfolioIdHex) &&
    isLikelyMongoObjectIdHex(effectiveId)
      ? buildPortfolioDeskHandoffUrls({
          portfolioIdHex,
          accountIdHex: effectiveId,
          accountName: selectedAccountName,
          portfolioName,
          positions: accountPositions,
          focusSymbol
        })
      : null;

  function syncWorkspaceAccountForDesk(): void {
    if (!portfolioIdHex || !effectiveId) {
      return;
    }
    if (!isLikelyMongoObjectIdHex(portfolioIdHex) || !isLikelyMongoObjectIdHex(effectiveId)) {
      return;
    }
    writeStoredWorkspaceAccountId(portfolioIdHex, effectiveId);
    dispatchWorkspaceAccountChanged({ portfolioId: portfolioIdHex, accountId: effectiveId });
  }

  function prepareXchatHandoff(): void {
    if (!deskHandoff) {
      return;
    }
    syncWorkspaceAccountForDesk();
    writePortfolioDeskXchatHandoff(
      buildPortfolioDeskXchatPrompt({
        accountName: selectedAccountName,
        portfolioName,
        symbol: deskHandoff.symbol
      })
    );
  }

  return (
    <div
      className="portfolio-account-manage-bar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.65rem",
        marginBottom: "0.5rem"
      }}
    >
      <label
        className="stack-gap"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "0.5rem",
          margin: 0,
          color: "var(--xf-text-200)",
          fontSize: "0.9rem"
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>Account</span>
        <select
          className="crud-input"
          style={{ minWidth: "12rem", maxWidth: "100%" }}
          value={effectiveId}
          onChange={(e) => {
            const v = e.target.value;
            if (isControlled) {
              onSelectedAccountIdChange?.(v);
            } else {
              setUserSelectedId(v);
            }
          }}
          aria-label="Select account to manage"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
      {deskHandoff ? (
        <Link
          className="cta cta-secondary portfolio-head-action-btn"
          href={deskHandoff.xoptionsHref}
          title={
            deskHandoff.symbol
              ? `Open xOptions for ${deskHandoff.symbol} in this account`
              : "Open xOptions for this account"
          }
          onClick={syncWorkspaceAccountForDesk}
        >
          xOptions
        </Link>
      ) : null}
      {deskHandoff ? (
        <Link
          className="cta cta-secondary portfolio-head-action-btn"
          href={deskHandoff.xchatHref}
          title="Open xChat with portfolio context and a prefilled prompt"
          onClick={prepareXchatHandoff}
        >
          xChat
        </Link>
      ) : null}
      <IconEditButton
        disabled={!effectiveId}
        label="Edit account"
        variant="primary-cta"
        onClick={goManage}
      />
    </div>
  );
}
