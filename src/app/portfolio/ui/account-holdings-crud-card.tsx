"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { SaveIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { AccountConsolidatedHoldingsTable } from "@/app/portfolio/ui/account-consolidated-holdings-table";
import { RealEstateHoldingForm } from "@/app/portfolio/ui/real-estate-holding-form";
import { StockSymbolLiveField } from "@/app/portfolio/ui/stock-symbol-live-field";
import type { PositionType } from "@/modules/core-admin/types";

type HoldingsAddMode = "securities" | "real_estate";

type AccountHoldingsCrudCardProps = {
  portfolioIdHex: string;
  accountIdHex: string;
  initialPositions: SerializablePosition[];
  /** When true (Edit Account tab), outer “Holdings” heading is screen-reader only — tab bar shows the label. */
  embeddedInTab?: boolean;
  accountLabel?: string | null;
  portfolioName?: string | null;
};

export function AccountHoldingsCrudCard({
  portfolioIdHex,
  accountIdHex,
  initialPositions,
  embeddedInTab = false,
  accountLabel = null,
  portfolioName = null
}: AccountHoldingsCrudCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState(initialPositions);

  const [addMode, setAddMode] = useState<HoldingsAddMode>("securities");
  const [holdingType, setHoldingType] = useState<PositionType>("stock");
  const [stSym, setStSym] = useState("");
  const [stShares, setStShares] = useState("");
  const [stPx, setStPx] = useState("");

  // Track if we're editing an existing stock position (for "select symbol → load current position into panel")
  const [editingStockPositionId, setEditingStockPositionId] = useState<string | null>(null);
  const [opSym, setOpSym] = useState("");
  const [opYref, setOpYref] = useState("");
  const [opCp, setOpCp] = useState<"call" | "put">("call");
  const [opStrike, setOpStrike] = useState("");
  const [opExp, setOpExp] = useState("");
  const [opContracts, setOpContracts] = useState("");
  const [opPrem, setOpPrem] = useState("");
  const [caLabel, setCaLabel] = useState("");
  const [caAmt, setCaAmt] = useState("");

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  // When the user types/selects a symbol, if it matches an existing stock position in this account,
  // load the current quantity and avg cost into the edit panel (edit mode).
  useEffect(() => {
    const sym = stSym.trim().toUpperCase();
    if (!sym) {
      setEditingStockPositionId(null);
      return;
    }

    const existing = positions.find(
      (p): p is SerializablePosition & { type: "stock" } =>
        p.type === "stock" && (p.symbol || "").trim().toUpperCase() === sym
    );

    if (existing) {
      setEditingStockPositionId(existing._id);
      // Only pre-fill if the user hasn't already started typing different values
      if (!stShares.trim()) {
        setStShares(String(existing.shares ?? ""));
      }
      if (!stPx.trim() && typeof existing.purchasePrice === "number") {
        setStPx(String(existing.purchasePrice));
      }
    } else {
      setEditingStockPositionId(null);
    }
  }, [stSym, positions]); // note: we intentionally don't include stShares/stPx to avoid loops

  async function addHolding(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (holdingType === "stock") {
      const symbol = stSym.trim().toUpperCase();
      const qty = Number.parseFloat(stShares);
      const avgCost = Number.parseFloat(stPx);
      if (!symbol || !Number.isFinite(qty) || qty <= 0) {
        setError("Stock: symbol and positive shares required.");
        return;
      }
      if (!Number.isFinite(avgCost) || avgCost < 0) {
        setError("Stock: non-negative purchase price required.");
        return;
      }

      let success = false;

      if (editingStockPositionId) {
        // User selected an existing symbol → update the current position (quantity correction, etc.)
        success = await updateStockPosition(editingStockPositionId, symbol, qty, avgCost);
      } else {
        const res = await fetch("/api/positions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: portfolioIdHex,
            accountId: accountIdHex,
            symbol,
            qty,
            avgCost,
            type: "stock"
          })
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(body.error ?? "Could not save stock position");
          return;
        }
        success = true;
      }

      if (success) {
        setStSym("");
        setStShares("");
        setStPx("");
        setEditingStockPositionId(null);
        startTransition(() => router.refresh());
      }
      return;
    }

    if (holdingType === "option") {
      const symbol = opSym.trim().toUpperCase();
      const yahooRef = opYref.trim();
      const strike = Number.parseFloat(opStrike);
      const qty = Number.parseFloat(opContracts);
      const avgCost = Number.parseFloat(opPrem);
      const expiration = opExp.trim();
      if (!symbol || !yahooRef) {
        setError("Option: underlying and yahoo_ref required.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
        setError("Option: expiration must be YYYY-MM-DD.");
        return;
      }
      if (!Number.isFinite(strike) || strike <= 0 || !Number.isFinite(qty) || qty <= 0) {
        setError("Option: positive strike and contracts required.");
        return;
      }
      if (!Number.isFinite(avgCost) || avgCost < 0) {
        setError("Option: non-negative premium per contract required.");
        return;
      }
      const res = await fetch("/api/positions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: portfolioIdHex,
          accountId: accountIdHex,
          type: "option",
          ticker: symbol,
          yahooRef,
          optionType: opCp,
          strike,
          expiration,
          contracts: qty,
          premium: avgCost
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save option position");
        return;
      }
      setOpSym("");
      setOpYref("");
      setOpStrike("");
      setOpExp("");
      setOpContracts("");
      setOpPrem("");
      startTransition(() => router.refresh());
      return;
    }

    const amount = Number.parseFloat(caAmt.replaceAll(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Cash: non-negative amount required.");
      return;
    }
    const label = caLabel.trim().toUpperCase() || "CASH";
    const res = await fetch("/api/positions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId: portfolioIdHex,
        accountId: accountIdHex,
        type: "cash",
        ticker: label,
        amount,
        shares: 1
      })
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not save cash position");
      return;
    }
    setCaLabel("");
    setCaAmt("");
    startTransition(() => router.refresh());
  }

  async function removePosition(positionId: string) {
    setError(null);
    const qs = new URLSearchParams({ portfolioId: portfolioIdHex, accountId: accountIdHex });
    const res = await fetch(`/api/positions/${encodeURIComponent(positionId)}?${qs.toString()}`, {
      method: "DELETE",
      credentials: "include"
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not delete position");
      return;
    }
    setPositions((prev) => prev.filter((p) => p._id !== positionId));
    startTransition(() => router.refresh());
  }

  async function updateStockPosition(positionId: string, symbol: string, qty: number, avgCost: number) {
    setError(null);
    const qs = new URLSearchParams({ portfolioId: portfolioIdHex, accountId: accountIdHex });
    const res = await fetch(`/api/positions/${encodeURIComponent(positionId)}?${qs.toString()}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qty,
        avgCost,
        symbol // in case user changed the symbol (rare)
      })
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      const message = body.error ?? "Could not update position";
      setError(message);
      return false;
    }
    return true;
  }

  return (
    <section
      className={`portfolio-edit-holdings-card xf-noise-overlay${embeddedInTab ? " portfolio-edit-holdings-card--in-tab" : ""}`}
      aria-labelledby="portfolio-acct-holdings-title"
    >
      <h2
        id="portfolio-acct-holdings-title"
        className={`portfolio-edit-account-card__title portfolio-edit-account-card__title--section${embeddedInTab ? " sr-only" : ""}`}
      >
        Holdings
      </h2>
      <h3 className="portfolio-edit-holdings-card__table-title">Positions</h3>
      <p className="portfolio-edit-holdings-card__table-hint">
        Broker-style grid: live <strong>Last</strong>, day/total gain, <strong>Current value</strong>,{" "}
        <strong>Cost basis</strong>, and stock <strong>52-week range</strong> from Yahoo quotes. Option rows use
        contract quotes when available; otherwise value stays on <strong>book</strong>. The <strong>Desk</strong> column
        saves a portfolio alert to <strong>Alerts</strong> + optional desk channels.
      </p>
      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}
      {positions.length === 0 ? (
        <p className="portfolio-edit-holdings-card__empty">
          No positions yet — add securities or an alternative holding below.
        </p>
      ) : (
        <div className="portfolio-edit-holdings-card__table-wrap">
          <AccountConsolidatedHoldingsTable
            pending={pending}
            portfolioIdHex={portfolioIdHex}
            accountIdHex={accountIdHex}
            accountLabel={accountLabel}
            portfolioName={portfolioName}
            positions={positions}
            onRemove={removePosition}
            onDeskAlertSaved={() => startTransition(() => router.refresh())}
          />
        </div>
      )}

      <div className="portfolio-edit-holdings-card__divider" aria-hidden />
      <h3 className="portfolio-edit-holdings-card__subtitle">
        {addMode === "real_estate"
          ? "Add alternative holding"
          : editingStockPositionId
            ? "Change position"
            : "Add or change position"}
      </h3>
      <div className="portfolio-edit-holdings-mode" role="tablist" aria-label="Add holding type">
        <button
          type="button"
          role="tab"
          aria-selected={addMode === "securities"}
          className={`portfolio-edit-holdings-mode__btn${addMode === "securities" ? " portfolio-edit-holdings-mode__btn--active" : ""}`}
          onClick={() => setAddMode("securities")}
        >
          Securities
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={addMode === "real_estate"}
          className={`portfolio-edit-holdings-mode__btn${addMode === "real_estate" ? " portfolio-edit-holdings-mode__btn--active" : ""}`}
          onClick={() => setAddMode("real_estate")}
        >
          Alternative holding
        </button>
      </div>

      {addMode === "real_estate" ? (
        <RealEstateHoldingForm
          portfolioId={portfolioIdHex}
          accountId={accountIdHex}
          disabled={pending}
          onSuccess={() => startTransition(() => router.refresh())}
          onError={setError}
        />
      ) : null}

      {addMode === "securities" ? (
      <form onSubmit={addHolding} className="stack-gap portfolio-edit-holdings-form">
        <label className="portfolio-edit-holdings-field">
          <span className="portfolio-edit-holdings-field__label">Instrument type</span>
          <select
            className="crud-input portfolio-edit-account-card__input"
            value={holdingType}
            onChange={(e) => setHoldingType(e.target.value as PositionType)}
            aria-label="Holding type"
          >
            <option value="stock">stock</option>
            <option value="option">option</option>
            <option value="cash">cash</option>
          </select>
        </label>

        {holdingType === "stock" ? (
          <div
            className="stack-gap"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))",
              gap: "0.75rem",
              maxWidth: "36rem",
              alignItems: "end"
            }}
          >
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>
                Symbol {editingStockPositionId ? <span className="text-[var(--xf-gain-green)]">(editing existing)</span> : null}
              </span>
              <input className="crud-input" value={stSym} onChange={(e) => setStSym(e.target.value)} placeholder="TSLA" />
              {/* Quick select from current holdings so user can easily load existing position into the edit panel */}
              {positions.some((p) => p.type === "stock") && !editingStockPositionId && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {positions
                    .filter((p): p is SerializablePosition & { type: "stock" } => p.type === "stock")
                    .slice(0, 6)
                    .map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        className="rounded border border-white/10 px-1.5 py-0.5 hover:bg-white/5"
                        onClick={() => setStSym(p.symbol || "")}
                      >
                        {p.symbol}
                      </button>
                    ))}
                </div>
              )}
            </label>
            <div className="stack-gap" style={{ gridColumn: "1 / -1", maxWidth: "28rem" }}>
              <StockSymbolLiveField
                purchasePrice={stPx}
                symbolInput={stSym}
                onSuggestPurchasePrice={setStPx}
              />
            </div>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Shares</span>
              <input
                className="crud-input"
                type="number"
                min={0}
                step="any"
                value={stShares}
                onChange={(e) => setStShares(e.target.value)}
              />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Purchase price</span>
              <input
                className="crud-input"
                type="number"
                min={0}
                step="0.01"
                value={stPx}
                onChange={(e) => setStPx(e.target.value)}
              />
            </label>
            <button type="submit" className="cta cta-primary" disabled={pending}>
              <SaveIcon className="crud-icon" />
              {editingStockPositionId ? "Change quantity" : "Add position"}
            </button>
          </div>
        ) : null}

        {holdingType === "option" ? (
          <div
            className="stack-gap"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
              gap: "0.75rem",
              maxWidth: "48rem",
              alignItems: "end"
            }}
          >
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Underlying</span>
              <input className="crud-input" value={opSym} onChange={(e) => setOpSym(e.target.value)} />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Yahoo ref</span>
              <input className="crud-input font-mono text-xs" value={opYref} onChange={(e) => setOpYref(e.target.value)} />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Call / put</span>
              <select className="crud-input" value={opCp} onChange={(e) => setOpCp(e.target.value as "call" | "put")}>
                <option value="call">call</option>
                <option value="put">put</option>
              </select>
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Strike</span>
              <input className="crud-input" value={opStrike} onChange={(e) => setOpStrike(e.target.value)} />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Expiration</span>
              <input
                className="crud-input font-mono text-xs"
                placeholder="YYYY-MM-DD"
                value={opExp}
                onChange={(e) => setOpExp(e.target.value)}
              />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Contracts</span>
              <input className="crud-input" value={opContracts} onChange={(e) => setOpContracts(e.target.value)} />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Premium / contract</span>
              <input className="crud-input" value={opPrem} onChange={(e) => setOpPrem(e.target.value)} />
            </label>
            <button type="submit" className="cta cta-primary" disabled={pending}>
              <SaveIcon className="crud-icon" />
              Save
            </button>
          </div>
        ) : null}

        {holdingType === "cash" ? (
          <div
            className="stack-gap"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))",
              gap: "0.75rem",
              maxWidth: "28rem",
              alignItems: "end"
            }}
          >
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Label (optional)</span>
              <input className="crud-input" value={caLabel} onChange={(e) => setCaLabel(e.target.value)} placeholder="CASH" />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Amount (USD)</span>
              <input className="crud-input" value={caAmt} onChange={(e) => setCaAmt(e.target.value)} />
            </label>
            <button type="submit" className="cta cta-primary" disabled={pending}>
              <SaveIcon className="crud-icon" />
              Save
            </button>
          </div>
        ) : null}
      </form>
      ) : null}
    </section>
  );
}
