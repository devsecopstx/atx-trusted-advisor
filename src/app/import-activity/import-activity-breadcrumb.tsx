"use client";

import { importActivityWorkflowCopy } from "./import-activity-copy";

export type ImportActivityStep = 1 | 2 | 3;

type ImportActivityBreadcrumbProps = {
  currentStep: ImportActivityStep;
  unlockedStep: ImportActivityStep;
  onStepChange: (step: ImportActivityStep) => void;
};

const CRUMBS: Array<{ step: ImportActivityStep; label: string }> = [
  { step: 1, label: importActivityWorkflowCopy.stepPortfolioLabel },
  { step: 2, label: importActivityWorkflowCopy.stepFileLabel },
  { step: 3, label: importActivityWorkflowCopy.stepReviewLabel }
];

export function ImportActivityBreadcrumb({
  currentStep,
  unlockedStep,
  onStepChange
}: ImportActivityBreadcrumbProps) {
  return (
    <nav className="import-activity-breadcrumb" aria-label="Broker import steps">
      <ol className="import-activity-breadcrumb__list">
        {CRUMBS.map((crumb, index) => {
          const enabled = crumb.step <= unlockedStep;
          const isCurrent = crumb.step === currentStep;
          return (
            <li key={crumb.step} className="import-activity-breadcrumb__item">
              {enabled ? (
                <button
                  type="button"
                  className={`import-activity-breadcrumb__link${isCurrent ? " import-activity-breadcrumb__link--current" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onStepChange(crumb.step)}
                >
                  <span className="import-activity-breadcrumb__num" aria-hidden>
                    {crumb.step}
                  </span>
                  {crumb.label}
                </button>
              ) : (
                <span
                  className="import-activity-breadcrumb__link import-activity-breadcrumb__link--disabled"
                  aria-disabled="true"
                >
                  <span className="import-activity-breadcrumb__num" aria-hidden>
                    {crumb.step}
                  </span>
                  {crumb.label}
                </span>
              )}
              {index < CRUMBS.length - 1 ? (
                <span className="import-activity-breadcrumb__sep" aria-hidden>
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
