"use client";

import { useCallback, useEffect, useState } from "react";

import { PortfolioAlertDetailModal } from "@/app/portfolio/alerts/portfolio-alert-detail-modal";
import { PortfolioAlertsManagePanel } from "@/app/portfolio/alerts/portfolio-alerts-manage-panel";
import { PortfolioAlertsStatsMotion } from "@/app/portfolio/alerts/portfolio-alerts-stats-motion";
import {
    PortfolioAlertsToolbar,
    type PortfolioAlertAccountOption
} from "@/app/portfolio/alerts/portfolio-alerts-toolbar";
import type { PriceRuleRowVm } from "@/app/portfolio/alerts/portfolio-alerts-types";
import { PortfolioAlertsUnifiedGrid } from "@/app/portfolio/alerts/portfolio-alerts-unified-grid";
import { PortfolioAlertsXchatHero } from "@/app/portfolio/alerts/portfolio-alerts-xchat-hero";
import type { PortfolioAlertRowVm } from "@/lib/portfolio-alert-desk-present";

export type { PortfolioAlertRowVm } from "@/lib/portfolio-alert-desk-present";

export function PortfolioAlertsInteractive(props: {
  portfolioId: string;
  portfolioName: string;
  rows: PortfolioAlertRowVm[];
  priceRules: PriceRuleRowVm[];
  alertAccounts?: readonly PortfolioAlertAccountOption[];
  nlPriceAlertsEnabled: boolean;
  lastActivityIso: string | null;
}) {
  const {
    portfolioId,
    portfolioName,
    rows,
    priceRules,
    alertAccounts = [],
    nlPriceAlertsEnabled,
    lastActivityIso
  } = props;

  const [detailRow, setDetailRow] = useState<PortfolioAlertRowVm | null>(null);
  const [editingRule, setEditingRule] = useState<PriceRuleRowVm | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  return (
    <>
      {toast ? (
        <div className="portfolio-alerts-toast" role="status">
          {toast}
        </div>
      ) : null}

      <PortfolioAlertsXchatHero portfolioId={portfolioId} portfolioName={portfolioName} />

      <PortfolioAlertsStatsMotion deskRows={rows} priceRules={priceRules} lastActivityIso={lastActivityIso} />

      <PortfolioAlertsManagePanel
        portfolioId={portfolioId}
        portfolioName={portfolioName}
        accounts={alertAccounts}
        nlPriceAlertsEnabled={nlPriceAlertsEnabled}
        editingRule={editingRule}
        onClearEdit={() => setEditingRule(null)}
      />

      <PortfolioAlertsToolbar portfolioId={portfolioId} alertCount={rows.length} />

      <PortfolioAlertsUnifiedGrid
        portfolioId={portfolioId}
        portfolioName={portfolioName}
        deskRows={rows}
        priceRules={priceRules}
        nlPriceAlertsEnabled={nlPriceAlertsEnabled}
        onOpenDeskDetail={setDetailRow}
        onEditPriceRule={setEditingRule}
        onToast={onToast}
      />

      <PortfolioAlertDetailModal
        portfolioId={portfolioId}
        portfolioName={portfolioName}
        row={detailRow}
        onClose={() => setDetailRow(null)}
      />
    </>
  );
}
