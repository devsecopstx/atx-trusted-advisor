"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type PortfolioAccountManageOption = {
  id: string;
  name: string;
  isDefault?: boolean;
};

type Props = {
  accounts: PortfolioAccountManageOption[];
};

export function PortfolioAccountManageBar({ accounts }: Props) {
  const router = useRouter();
  const preferredId = useMemo(() => {
    const d = accounts.find((a) => a.isDefault);
    return d?.id ?? accounts[0]?.id ?? "";
  }, [accounts]);

  const [userSelectedId, setUserSelectedId] = useState("");

  const effectiveId = useMemo(() => {
    if (userSelectedId && accounts.some((a) => a.id === userSelectedId)) {
      return userSelectedId;
    }
    return preferredId;
  }, [accounts, preferredId, userSelectedId]);

  if (accounts.length === 0) {
    return null;
  }

  function goManage() {
    if (!effectiveId) return;
    router.push(`/portfolio/accounts/${encodeURIComponent(effectiveId)}`);
  }

  return (
    <div
      className="portfolio-account-manage-bar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.65rem",
        marginBottom: "0.85rem"
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
          onChange={(e) => setUserSelectedId(e.target.value)}
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
      <button type="button" className="cta cta-primary" disabled={!effectiveId} onClick={goManage}>
        Manage account
      </button>
    </div>
  );
}
