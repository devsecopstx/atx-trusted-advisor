"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useWorkspaceAccountSelection } from "@/app/ui/use-workspace-account-selection";
import type { AppUserWorkspaceAccountRef } from "@/lib/app-user-default-book";
import { dispatchWorkspaceAccountChanged, writeStoredWorkspaceAccountId } from "@/lib/workspace-account-selection";

type AppUserWorkspaceAccountPickerProps = {
  portfolioId: string;
  accounts: AppUserWorkspaceAccountRef[];
  serverDefaultAccountId: string | null;
};

export function AppUserWorkspaceAccountPicker({
  portfolioId,
  accounts,
  serverDefaultAccountId
}: AppUserWorkspaceAccountPickerProps) {
  const validIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const selectedId = useWorkspaceAccountSelection(portfolioId, validIds, serverDefaultAccountId);

  if (accounts.length === 0) {
    return (
      <div className="app-user-rail-workspace-row">
        <span className="app-user-rail-workspace-k">Account</span>
        <span className="app-user-rail-workspace-v">No linked account</span>
      </div>
    );
  }

  if (accounts.length === 1) {
    const only = accounts[0];
    return (
      <div className="app-user-rail-workspace-row">
        <span className="app-user-rail-workspace-k">Account</span>
        <Link className="app-user-rail-workspace-v app-user-rail-workspace-v--link" href={`/portfolio/accounts/${only.id}`} title="Open account workspace">
          {only.name}
        </Link>
      </div>
    );
  }

  const onChange = (id: string) => {
    writeStoredWorkspaceAccountId(portfolioId, id);
    dispatchWorkspaceAccountChanged({ portfolioId, accountId: id });
  };

  return (
    <div className="app-user-rail-workspace-row app-user-rail-workspace-row--stack">
      <span className="app-user-rail-workspace-k" id={`workspace-account-lbl-${portfolioId}`}>
        Account
      </span>
      <select
        aria-labelledby={`workspace-account-lbl-${portfolioId}`}
        className="app-user-rail-account-select"
        value={selectedId ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
      {selectedId ? (
        <Link className="app-user-rail-account-open" href={`/portfolio/accounts/${selectedId}`} title="Open account workspace">
          Open
        </Link>
      ) : null}
    </div>
  );
}
