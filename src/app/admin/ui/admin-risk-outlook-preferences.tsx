"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import {
    DEFAULT_INVESTMENT_STRATEGY,
    INVESTMENT_STRATEGY_OPTIONS,
    RISK_LEVEL_OPTIONS,
    type RiskProfileValue
} from "@/modules/core-admin/portfolio-preference-labels";
import type { InvestmentStrategy } from "@/modules/core-admin/types";

type PortfolioSlice = {
  riskProfile: RiskProfileValue;
  investmentStrategy: InvestmentStrategy;
  baseCurrency: "USD" | "EUR" | "GBP";
  rebalanceFrequencyDays: number;
};

type UserAdminSettingsPayload = {
  assignedPersonaId?: string;
  finraLicenseUploadUrl?: string;
  broker: {
    provider: "alpaca" | "interactive-brokers" | "paper";
    accountRef: string;
    enabled: boolean;
  };
  portfolio: PortfolioSlice;
  account: {
    accountStatus: "active" | "suspended";
    maxConcurrentSessions: number;
    timezone: string;
  };
  notificationDefaults: {
    email: boolean;
    push: boolean;
    sms: boolean;
    digestHourUTC: number;
  };
};

const selectedCard =
  "border-2 border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40 shadow-sm";
const idleCard = "border border-slate-600/80 bg-slate-900/40 hover:border-slate-500";

const selectedRisk =
  "border-2 border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40 shadow-sm";
const idleRisk = "border border-slate-600/80 bg-slate-900/40 hover:border-slate-500";

type AdminRiskOutlookPreferencesProps = {
  userId: string;
  portfolioId?: string;
  /** Tighter spacing when embedded on portfolio accounts page */
  compact?: boolean;
  /** `page` = dedicated `/admin/manage_account` surface; `embedded` = strip on accounts page */
  variant?: "page" | "embedded";
};

export function AdminRiskOutlookPreferences({
  userId,
  portfolioId,
  compact,
  variant = "embedded"
}: AdminRiskOutlookPreferencesProps) {
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullPayload, setFullPayload] = useState<UserAdminSettingsPayload | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfileValue>("balanced");
  const [investmentStrategy, setInvestmentStrategy] = useState<InvestmentStrategy>(
    DEFAULT_INVESTMENT_STRATEGY
  );

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("Loading preferences…");
    try {
      const res = await parseJson<{ data: UserAdminSettingsPayload }>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`, { cache: "no-store" })
      );
      const p = res.data.portfolio;
      setFullPayload({
        assignedPersonaId: res.data.assignedPersonaId,
        finraLicenseUploadUrl: res.data.finraLicenseUploadUrl,
        broker: res.data.broker,
        portfolio: p,
        account: res.data.account,
        notificationDefaults: res.data.notificationDefaults
      });
      setRiskProfile(p.riskProfile);
      setInvestmentStrategy(p.investmentStrategy ?? DEFAULT_INVESTMENT_STRATEGY);
      setStatus("Ready");
    } catch (e) {
      setFullPayload(null);
      setStatus(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!fullPayload) {
      setStatus("Nothing to save — load settings first");
      return;
    }
    setSaving(true);
    setStatus("Saving…");
    try {
      const body: UserAdminSettingsPayload = {
        ...fullPayload,
        portfolio: {
          ...fullPayload.portfolio,
          riskProfile,
          investmentStrategy
        }
      };
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      );
      setFullPayload(body);
      setStatus("Saved");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const accountsHref = portfolioId
    ? `/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`
    : "/admin/portfolios";
  const fullPageHref = `/admin/manage_account?userId=${encodeURIComponent(userId)}${
    portfolioId ? `&portfolioId=${encodeURIComponent(portfolioId)}` : ""
  }`;

  return (
    <article
      className={`surface-card xf-widget section-card ${compact ? "!p-4" : ""}`}
      data-testid="admin-risk-outlook-preferences"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`font-semibold text-slate-100 ${compact ? "text-base" : "text-lg"}`}>
            Risk &amp; market outlook
          </h3>
          <p className="status-text mt-1 max-w-prose text-xs text-slate-400">
            Workspace preferences for this user&apos;s portfolio tooling (stored in{" "}
            <code className="font-mono text-[0.7rem]">admin_user_settings</code>).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="cta cta-secondary text-xs" href={accountsHref}>
            {variant === "page" ? "← Portfolio accounts" : "← Accounts"}
          </Link>
          <Link className="cta cta-secondary text-xs" href="/admin/portfolios">
            All portfolios
          </Link>
          {variant === "embedded" ? (
            <Link className="cta cta-secondary text-xs" href={fullPageHref}>
              Open full page
            </Link>
          ) : null}
          <button
            className="cta cta-primary text-sm"
            disabled={loading || saving || !fullPayload}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>

      <p className="status-text mt-2 text-xs">{status}</p>

      {loading ? null : !fullPayload ? (
        <p className="status-text mt-4 text-sm text-amber-400">
          Settings not found for this user. Create them from{" "}
          <Link className="underline" href="/admin/manage-users">
            Admin → Users
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className={`mt-6 stack-gap ${compact ? "gap-4" : "gap-6"}`}>
          <div>
            <h4 className="mb-3 text-sm font-medium text-slate-300">Risk level</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {RISK_LEVEL_OPTIONS.map((opt) => {
                const on = riskProfile === opt.riskProfile;
                return (
                  <button
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-100 transition-colors ${
                      on ? selectedRisk : idleRisk
                    }`}
                    key={opt.tier}
                    onClick={() => setRiskProfile(opt.riskProfile)}
                    type="button"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.dotClass}`} aria-hidden />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-slate-300">Market outlook</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {INVESTMENT_STRATEGY_OPTIONS.map((opt) => {
                const on = investmentStrategy === opt.value;
                return (
                  <button
                    className={`rounded-lg p-4 text-left transition-colors ${on ? selectedCard : idleCard}`}
                    key={opt.value}
                    onClick={() => setInvestmentStrategy(opt.value)}
                    type="button"
                  >
                    <div className="font-semibold text-slate-100">{opt.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
