"use client";

import { motion } from "framer-motion";

import type { PortfolioAlertRowVm } from "@/lib/portfolio-alert-desk-present";
import { isOptionStyleAlert } from "@/lib/portfolio-alert-insights";

import type { PriceRuleRowVm } from "@/app/portfolio/alerts/portfolio-alerts-types";

type PortfolioAlertsStatsMotionProps = {
  deskRows: PortfolioAlertRowVm[];
  priceRules: PriceRuleRowVm[];
  lastActivityIso: string | null;
};

function fmtScan(iso: string | null): string {
  if (!iso) {
    return "No alert timestamps yet";
  }
  try {
    const d = new Date(iso);
    return `Latest activity ${d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  } catch {
    return "Latest activity —";
  }
}

export function PortfolioAlertsStatsMotion({ deskRows, priceRules, lastActivityIso }: PortfolioAlertsStatsMotionProps) {
  const warnings = deskRows.filter((r) => r.severity === "warning").length;
  const critical = deskRows.filter((r) => r.severity === "critical").length;
  const deskSyms = new Set(deskRows.map((r) => (r.symbol ?? "").trim().toUpperCase()).filter(Boolean));
  for (const p of priceRules) {
    deskSyms.add(p.symbol.trim().toUpperCase());
  }
  const accounts = new Set(deskRows.map((r) => (r.accountName ?? "").trim()).filter(Boolean));
  const optionSignals = deskRows.filter((r) => isOptionStyleAlert(r.title, r.body)).length;
  const openTotal = deskRows.length + priceRules.length;

  const pills = [
    {
      key: "open",
      label: "Open alerts",
      value: openTotal,
      hint: "Desk scanner rows plus active NL price rules for this book.",
      tone: "open" as const
    },
    {
      key: "warn",
      label: "Warnings",
      value: warnings,
      hint: "Desk alerts at warning severity (options / price / risk copy).",
      tone: "warn" as const
    },
    {
      key: "crit",
      label: "Critical",
      value: critical,
      hint: "Highest-severity desk signals — review before market.",
      tone: "crit" as const
    },
    {
      key: "sym",
      label: "Symbols touched",
      value: deskSyms.size,
      hint: "Distinct tickers across desk + NL price rules.",
      tone: "neutral" as const
    },
    {
      key: "acct",
      label: "Accounts named",
      value: accounts.size,
      hint: "Custodian accounts referenced on desk rows.",
      tone: "neutral" as const
    },
    {
      key: "opt",
      label: "Option signals",
      value: optionSignals,
      hint: "Desk rows classified as option-contract signals.",
      tone: "gain" as const
    }
  ];

  return (
    <motion.section
      className="portfolio-alerts-summary portfolio-alerts-summary--hnwi"
      aria-label="Portfolio alert impact"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
    >
      <div className="portfolio-alerts-summary__grid">
        {pills.map((p, i) => (
          <motion.div
            key={p.key}
            className={`portfolio-alerts-summary__tile portfolio-alerts-summary__tile--${p.tone}`}
            title={p.hint}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.05 + i * 0.03 }}
          >
            <span className="portfolio-alerts-summary__value">{p.value}</span>
            <span className="portfolio-alerts-summary__label">{p.label}</span>
          </motion.div>
        ))}
      </div>
      <p className="portfolio-alerts-summary__scan-hint" title={fmtScan(lastActivityIso)}>
        {fmtScan(lastActivityIso)}
      </p>
    </motion.section>
  );
}
