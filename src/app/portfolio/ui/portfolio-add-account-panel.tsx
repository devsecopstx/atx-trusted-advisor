"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { AddIcon } from "@/app/admin/ui/crud-icons";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_PICKER_ORDER } from "@/lib/broker-ui";
import { type AccountType } from "@/modules/core-admin/types";

type Props = {
  portfolioId: string;
};

function parseUsdCash(raw: string): number | undefined {
  const n = Number.parseFloat(raw.replaceAll(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return n;
}

export function PortfolioAddAccountPanel({ portfolioId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("fidelity");
  const [extId, setExtId] = useState("");
  const [cashRaw, setCashRaw] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter an account name.");
      return;
    }
    const cash = cashRaw.trim() ? parseUsdCash(cashRaw) : undefined;
    if (cashRaw.trim() && cash === undefined) {
      setError("Cash must be a non-negative number.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/portfolios/${encodeURIComponent(portfolioId)}/accounts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          type,
          ...(extId.trim() ? { extAccountId: extId.trim() } : {}),
          ...(cash !== undefined ? { cashBalance: cash } : {})
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Could not add account (${res.status}).`);
        return;
      }
      setName("");
      setExtId("");
      setCashRaw("");
      router.refresh();
    });
  }

  return (
    <details className="portfolio-disclosure portfolio-add-account-panel">
      <summary className="portfolio-disclosure__summary">
        <AddIcon className="crud-icon" aria-hidden />
        Add account
      </summary>
      <div className="portfolio-disclosure__body">
        <p className="portfolio-disclosure__hint">New custodian account in this book. Bulk CSV import is in admin Hub.</p>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="portfolio-add-account-form"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.65rem",
            alignItems: "flex-end"
          }}
        >
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Name</span>
          <input
            className="crud-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            required
            aria-label="New account name"
          />
        </label>
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Broker</span>
          <select
            className="crud-input"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            aria-label="Broker type"
          >
            {ACCOUNT_TYPE_PICKER_ORDER.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Account ref (optional)</span>
          <input
            className="crud-input font-mono text-xs"
            value={extId}
            onChange={(e) => setExtId(e.target.value)}
            autoComplete="off"
            aria-label="External account reference"
          />
        </label>
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Initial cash (optional)</span>
          <input
            className="crud-input"
            value={cashRaw}
            onChange={(e) => setCashRaw(e.target.value)}
            placeholder="25,000"
            aria-label="Initial cash balance"
          />
        </label>
          <button type="submit" className="cta cta-primary" disabled={pending}>
            {pending ? "Adding…" : "Add account"}
          </button>
        </form>
        {error ? (
          <p className="status-text status-error" style={{ margin: "0.6rem 0 0" }}>
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
