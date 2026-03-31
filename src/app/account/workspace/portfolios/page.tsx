import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { getPortfolioTotalBookUsdForSessionUser } from "@/lib/portfolio-total-book-usd";
import { adminListBrokerCatalog, listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";
import {
    accountOutlookDisplayLabel,
    parseAccountOutlook,
    portfolioKindChoiceLabel
} from "@/modules/core-admin/types";
import { canUserLogin } from "@/modules/identity/authorization";

import { ManageWorkspacePortfoliosClient, type ManagePortfolioRow } from "./manage-workspace-portfolios-client";

import "../../billing/billing-plans.css";

export const dynamic = "force-dynamic";

export default async function ManageWorkspacePortfoliosPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat?next=/account/workspace/portfolios");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });

  let brokerCatalog: Awaited<ReturnType<typeof adminListBrokerCatalog>> = [];
  try {
    brokerCatalog = await adminListBrokerCatalog();
  } catch {
    brokerCatalog = [];
  }
  const brokerByType = new Map(brokerCatalog.map((b) => [b.type.toLowerCase(), b]));

  const rows: Array<{
    portfolio: Portfolio;
    valueUsd: number;
    brokerLabel: string;
    brokerIconUrl: string | null;
  }> = [];
  for (const p of portfolios) {
    const id = p._id?.toHexString();
    if (!id) {
      continue;
    }
    let valueUsd = 0;
    try {
      valueUsd = await getPortfolioTotalBookUsdForSessionUser({
        userId: session.userId,
        tenantId: session.tenantId,
        portfolioId: id
      });
    } catch {
      valueUsd = 0;
    }
    const bt = typeof p.broker_type === "string" ? p.broker_type.trim().toLowerCase() : "";
    const brokerEntry = bt ? brokerByType.get(bt) : undefined;
    const brokerLabel = bt ? brokerEntry?.name ?? bt : "—";
    rows.push({ portfolio: p, valueUsd, brokerLabel, brokerIconUrl: brokerEntry?.iconUrl ?? null });
  }

  const initialRows: ManagePortfolioRow[] = rows.map(({ portfolio: p, valueUsd, brokerLabel, brokerIconUrl }) => {
    const id = p._id?.toHexString() ?? "";
    const bt = typeof p.broker_type === "string" ? p.broker_type.trim().toLowerCase() : "";
    const portfolioKind: ManagePortfolioRow["portfolioKind"] =
      p.portfolioKind === "real_estate"
        ? "real_estate"
        : p.portfolioKind === "investments"
          ? "investments"
          : null;
    const outlookCanonical = parseAccountOutlook(p.outlook ?? "") ?? null;
    return {
      id,
      name: p.name || "Portfolio",
      isDefault: !!p.isDefault,
      outlook: outlookCanonical,
      broker_type: bt ? bt : null,
      portfolioKind,
      valueUsd,
      outlookLabel: accountOutlookDisplayLabel(outlookCanonical),
      brokerLabel,
      brokerIconUrl,
      kindLabel: portfolioKindChoiceLabel(p.portfolioKind ?? null)
    };
  });

  const brokers = brokerCatalog.map((b) => ({
    type: b.type,
    name: b.name,
    iconUrl: b.iconUrl
  }));

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="account" feedbackPageLabel="Portfolios" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<AppUserAccountPublicRailForSession session={session} />}
        >
          <div className="billing-page">
            <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
              <p className="billing-hero__eyebrow">Workspace</p>
              <h1 className="billing-hero__title">Manage portfolios</h1>
              <p className="billing-hero__copy">
                Portfolios only — no account detail here.{" "}
                <Link className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline" href="/portfolio">
                  Open portfolio
                </Link>{" "}
                for accounts, positions, and holdings.
              </p>
            </header>

            <div className="mt-6 surface-card xf-widget section-card p-4 md:p-6">
              <ManageWorkspacePortfoliosClient brokers={brokers} initialRows={initialRows} />
              <p className="mt-4 text-xs text-[var(--xf-text-300)]">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Values are book-style totals
                (cash + cost basis), not live market marks.
              </p>
            </div>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
