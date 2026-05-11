"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
    buildXoptionsBuilderHref,
    persistXoptionsBuilderSession,
    type XoptionsBuilderStep,
    type XoptionsBuilderUrlState
} from "@/lib/xoptions/xoptions-builder-url";

type XoptionsBreadcrumbProps = {
  currentStep: XoptionsBuilderStep;
  symbol: string | null;
  contractId: string | null;
  outlook: string | null;
  strategy: string | null;
  unlockedStep: number;
  pathname?: string;
};

const CRUMBS: Array<{ step: XoptionsBuilderStep; label: string }> = [
  { step: 1, label: "Symbol" },
  { step: 2, label: "Outlook" },
  { step: 3, label: "Strategy" },
  { step: 4, label: "Contract" },
  { step: 5, label: "Review" }
];

export function XoptionsBreadcrumb({
  currentStep,
  symbol,
  contractId,
  outlook,
  strategy,
  unlockedStep,
  pathname = "/xoptions"
}: XoptionsBreadcrumbProps) {
  const state = useMemo(
    (): XoptionsBuilderUrlState => ({
      step: currentStep,
      symbol,
      contractId,
      outlook,
      strategy
    }),
    [contractId, currentStep, outlook, strategy, symbol]
  );

  return (
    <nav className="xoptions-breadcrumb" aria-label="xOptions builder steps">
      <ol className="xoptions-breadcrumb__list">
        {CRUMBS.map((crumb, index) => {
          const enabled = crumb.step <= unlockedStep;
          const href = buildXoptionsBuilderHref(pathname, {
            ...state,
            step: crumb.step,
            symbol,
            contractId
          });
          const isCurrent = crumb.step === currentStep;
          return (
            <li key={crumb.step} className="xoptions-breadcrumb__item">
              {enabled ? (
                <Link
                  href={href}
                  className={`xoptions-breadcrumb__link${isCurrent ? " xoptions-breadcrumb__link--current" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => persistXoptionsBuilderSession({ ...state, step: crumb.step })}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="xoptions-breadcrumb__link xoptions-breadcrumb__link--disabled" aria-disabled="true">
                  {crumb.label}
                </span>
              )}
              {index < CRUMBS.length - 1 ? (
                <span className="xoptions-breadcrumb__sep" aria-hidden>
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
