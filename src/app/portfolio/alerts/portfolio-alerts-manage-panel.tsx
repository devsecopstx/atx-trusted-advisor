"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import type { PortfolioAlertAccountOption } from "@/app/portfolio/alerts/portfolio-alerts-toolbar";
import type { PriceRuleRowVm } from "@/app/portfolio/alerts/portfolio-alerts-types";
import { XCHAT_PENDING_PROMPT_STORAGE_KEY } from "@/lib/xchat/xchat-pending-prompt";

type TabId = "real" | "test";

type PortfolioAlertsManagePanelProps = {
  portfolioId: string;
  portfolioName: string;
  accounts: readonly PortfolioAlertAccountOption[];
  nlPriceAlertsEnabled: boolean;
  editingRule: PriceRuleRowVm | null;
  onClearEdit: () => void;
};

export function PortfolioAlertsManagePanel({
  portfolioId,
  portfolioName,
  accounts,
  nlPriceAlertsEnabled,
  editingRule,
  onClearEdit
}: PortfolioAlertsManagePanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("real");

  const [testTitle, setTestTitle] = useState("[Test] Desk alert");
  const [testBody, setTestBody] = useState(
    "Synthetic test alert from Portfolio alerts. Safe to delete — use Clear all after verification."
  );
  const [testSeverity, setTestSeverity] = useState<"info" | "warning" | "critical">("info");
  const [testSymbol, setTestSymbol] = useState("");
  const [testAccountId, setTestAccountId] = useState("");

  const [sym, setSym] = useState("");
  const [targetStr, setTargetStr] = useState("");
  const [ruleKind, setRuleKind] = useState<"above" | "below" | "crosses">("above");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const [busy, setBusy] = useState<"idle" | "real" | "test">("idle");
  const [error, setError] = useState<string | null>(null);

  const deskBase = `/api/portfolios/${encodeURIComponent(portfolioId)}/alerts`;
  const priceBase = `/api/portfolios/${encodeURIComponent(portfolioId)}/price-alerts`;

  useEffect(() => {
    if (editingRule) {
      setTab("real");
      setSym(editingRule.symbol);
      setTargetStr(String(editingRule.targetPriceUsd));
      setRuleKind(editingRule.ruleKind);
    }
  }, [editingRule]);

  const refreshQuote = useCallback(async () => {
    const s = sym.trim().toUpperCase();
    if (!s || s.length < 1) {
      setSpot(null);
      return;
    }
    setQuoteBusy(true);
    setError(null);
    try {
      const u = new URL("/api/market/symbol-quotes", window.location.origin);
      u.searchParams.set("symbols", s);
      u.searchParams.set("portfolioId", portfolioId);
      const res = await fetch(u.toString(), { credentials: "include" });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: Record<string, { price?: number } | null>;
      };
      const row = payload.data?.[s];
      const px = row && typeof row.price === "number" && Number.isFinite(row.price) ? row.price : null;
      setSpot(px);
    } catch {
      setSpot(null);
    } finally {
      setQuoteBusy(false);
    }
  }, [portfolioId, sym]);

  useEffect(() => {
    const t = setTimeout(() => void refreshQuote(), 320);
    return () => clearTimeout(t);
  }, [sym, refreshQuote]);

  const targetNum = Number.parseFloat(targetStr);
  const distancePct =
    spot != null && Number.isFinite(targetNum) && targetNum !== 0
      ? ((spot - targetNum) / targetNum) * 100
      : null;

  const submitReal = async (e: FormEvent) => {
    e.preventDefault();
    if (!nlPriceAlertsEnabled) {
      return;
    }
    const symbol = sym.trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,32}$/.test(symbol)) {
      setError("Enter a valid symbol.");
      return;
    }
    if (!Number.isFinite(targetNum) || targetNum <= 0 || targetNum > 1_000_000) {
      setError("Target price must be a positive number.");
      return;
    }
    setBusy("real");
    setError(null);
    try {
      const res = await fetch(priceBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, targetPriceUsd: targetNum, ruleKind })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `Save failed (${res.status})`);
        return;
      }
      onClearEdit();
      router.refresh();
    } catch {
      setError("Save failed");
    } finally {
      setBusy("idle");
    }
  };

  const submitTest = async (e: FormEvent) => {
    e.preventDefault();
    const title = testTitle.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    setBusy("test");
    setError(null);
    try {
      const payload: Record<string, unknown> = { title, severity: testSeverity };
      const body = testBody.trim();
      if (body) {
        payload.body = body;
      }
      const ts = testSymbol.trim().toUpperCase();
      if (ts) {
        payload.symbol = ts.slice(0, 32);
      }
      const acc = testAccountId.trim();
      if (acc) {
        payload.accountId = acc;
      }
      const res = await fetch(deskBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `Create failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Create failed");
    } finally {
      setBusy("idle");
    }
  };

  const buildXchatDraft = () => {
    const s = sym.trim().toUpperCase();
    const t = targetStr.trim();
    const rk =
      ruleKind === "above" ? "above" : ruleKind === "below" ? "below" : "crosses";
    if (s && t) {
      return `add alert ${s} ${t} ${rk} for portfolio ${portfolioName}`;
    }
    return `list my price alerts`;
  };

  const openXchatPrefill = () => {
    try {
      sessionStorage.setItem(XCHAT_PENDING_PROMPT_STORAGE_KEY, buildXchatDraft());
    } catch {
      /* ignore */
    }
    router.push(`/xchat?portfolioId=${encodeURIComponent(portfolioId)}&item=composer`);
  };

  return (
    <div className="portfolio-alerts-manage">
      <div className="portfolio-alerts-manage__tabs" role="tablist" aria-label="Create alerts">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "real"}
          className={`portfolio-alerts-manage__tab ${tab === "real" ? "portfolio-alerts-manage__tab--on" : ""}`}
          onClick={() => setTab("real")}
        >
          Create real alert
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "test"}
          className={`portfolio-alerts-manage__tab ${tab === "test" ? "portfolio-alerts-manage__tab--on" : ""}`}
          onClick={() => setTab("test")}
        >
          Create test alert
        </button>
      </div>

      {tab === "real" ? (
        <form className="portfolio-alerts-manage__form" onSubmit={(ev) => void submitReal(ev)}>
          {!nlPriceAlertsEnabled ? (
            <p className="status-text status-warn portfolio-alerts-manage__gate">
              NL price alerts require <strong>Premium+</strong> with an <strong>advisor</strong> seat (same gate as xChat).
              Desk test alerts remain available on the other tab.
            </p>
          ) : null}
          <div className="portfolio-alerts-manage__grid">
            <label className="portfolio-alerts-create-test__field">
              <span className="portfolio-alerts-create-test__label">Symbol</span>
              <input
                className="portfolio-alerts-create-test__input"
                value={sym}
                onChange={(ev) => setSym(ev.target.value)}
                maxLength={32}
                placeholder="TSLA"
                disabled={!nlPriceAlertsEnabled}
                autoComplete="off"
                list="portfolio-alerts-symbol-hints"
              />
            </label>
            <label className="portfolio-alerts-create-test__field">
              <span className="portfolio-alerts-create-test__label">Target price (USD)</span>
              <input
                className="portfolio-alerts-create-test__input"
                value={targetStr}
                onChange={(ev) => setTargetStr(ev.target.value)}
                inputMode="decimal"
                disabled={!nlPriceAlertsEnabled}
                placeholder="420"
              />
            </label>
            <fieldset className="portfolio-alerts-manage__radios">
              <legend className="portfolio-alerts-create-test__label">Direction</legend>
              {(["above", "below", "crosses"] as const).map((k) => (
                <label key={k} className="portfolio-alerts-manage__radio">
                  <input
                    type="radio"
                    name="ruleKind"
                    value={k}
                    checked={ruleKind === k}
                    onChange={() => setRuleKind(k)}
                    disabled={!nlPriceAlertsEnabled}
                  />
                  {k === "above" ? "Above" : k === "below" ? "Below" : "Crosses"}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="portfolio-alerts-manage__quote">
            <span className="portfolio-alerts-manage__quote-label">Live quote (Yahoo)</span>
            {quoteBusy ? (
              <span className="portfolio-alerts-manage__quote-val">Loading…</span>
            ) : spot != null ? (
              <span className="portfolio-alerts-manage__quote-val">
                ${spot.toFixed(2)}
                {distancePct != null ? (
                  <span
                    className={`portfolio-alerts-manage__dist ${distancePct >= 0 ? "portfolio-alerts-manage__dist--up" : "portfolio-alerts-manage__dist--down"}`}
                  >
                    {" "}
                    ({distancePct >= 0 ? "+" : ""}
                    {distancePct.toFixed(2)}% vs target)
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="portfolio-alerts-manage__quote-muted">Enter a symbol for spot check</span>
            )}
            <button type="button" className="portfolio-alerts-manage__linkish" onClick={() => void refreshQuote()}>
              Refresh quote
            </button>
          </div>
          <div className="portfolio-alerts-manage__footer">
            <button
              type="submit"
              className="portfolio-alerts-toolbar__btn portfolio-alerts-toolbar__btn--primary"
              disabled={!nlPriceAlertsEnabled || busy !== "idle"}
            >
              {busy === "real" ? "Saving…" : editingRule ? "Update rule" : "Save price rule"}
            </button>
            {editingRule ? (
              <button type="button" className="portfolio-alerts-toolbar__btn" onClick={onClearEdit}>
                Cancel edit
              </button>
            ) : null}
            <button
              type="button"
              className="portfolio-alerts-toolbar__btn"
              disabled={!nlPriceAlertsEnabled}
              onClick={openXchatPrefill}
            >
              Create via xChat
            </button>
            <Link className="portfolio-alerts-manage__subtle" href="/account/billing">
              Plans &amp; seats
            </Link>
          </div>
        </form>
      ) : (
        <form className="portfolio-alerts-manage__form" onSubmit={(ev) => void submitTest(ev)}>
          <div className="portfolio-alerts-create-test__form portfolio-alerts-create-test__form--manage">
            <label className="portfolio-alerts-create-test__field">
              <span className="portfolio-alerts-create-test__label">Title</span>
              <input
                className="portfolio-alerts-create-test__input"
                value={testTitle}
                onChange={(ev) => setTestTitle(ev.target.value)}
                maxLength={200}
                required
              />
            </label>
            <label className="portfolio-alerts-create-test__field portfolio-alerts-create-test__field--grow">
              <span className="portfolio-alerts-create-test__label">Body</span>
              <textarea
                className="portfolio-alerts-create-test__textarea"
                value={testBody}
                onChange={(ev) => setTestBody(ev.target.value)}
                rows={3}
                maxLength={4000}
              />
            </label>
            <label className="portfolio-alerts-create-test__field">
              <span className="portfolio-alerts-create-test__label">Severity</span>
              <select
                className="portfolio-alerts-create-test__select"
                value={testSeverity}
                onChange={(ev) => setTestSeverity(ev.target.value as "info" | "warning" | "critical")}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="portfolio-alerts-create-test__field">
              <span className="portfolio-alerts-create-test__label">Symbol (optional)</span>
              <input
                className="portfolio-alerts-create-test__input"
                value={testSymbol}
                onChange={(ev) => setTestSymbol(ev.target.value)}
                maxLength={32}
              />
            </label>
            <label className="portfolio-alerts-create-test__field">
              <span className="portfolio-alerts-create-test__label">Account (optional)</span>
              <select
                className="portfolio-alerts-create-test__select"
                value={testAccountId}
                onChange={(ev) => setTestAccountId(ev.target.value)}
              >
                <option value="">— None —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="portfolio-alerts-create-test__submit-row">
              <button
                type="submit"
                className="portfolio-alerts-toolbar__btn portfolio-alerts-toolbar__btn--primary"
                disabled={busy !== "idle"}
              >
                {busy === "test" ? "Creating…" : "Create test desk row"}
              </button>
            </div>
          </div>
        </form>
      )}
      {error ? <p className="portfolio-alerts-toolbar__error status-text status-error">{error}</p> : null}
      <datalist id="portfolio-alerts-symbol-hints">
        <option value="TSLA" />
        <option value="NVDA" />
        <option value="AMD" />
        <option value="AAPL" />
        <option value="MSFT" />
      </datalist>
    </div>
  );
}
