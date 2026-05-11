"use client";

import { useMediaQuery } from "@/lib/hooks/use-media-query";

export type XoptionsStepperStep = {
  n: number;
  title: string;
};

type XoptionsStepperProps = {
  steps: XoptionsStepperStep[];
  currentStep: number;
  unlockedStep: number;
  onStepSelect: (step: number) => void;
};

export function XoptionsStepper({ steps, currentStep, unlockedStep, onStepSelect }: XoptionsStepperProps) {
  const compact = useMediaQuery("(max-width: 640px)");
  const total = steps.length;
  const progressPct = total > 0 ? Math.min(100, Math.max(0, (currentStep / total) * 100)) : 0;

  if (compact) {
    return <CompactStepperProgress currentStep={currentStep} progressPct={progressPct} total={total} />;
  }

  return (
    <nav className="xoptions-stepper" aria-label="Strategy builder progress">
      {steps.map((step, index) => (
        <div key={step.n} className="xoptions-stepper__segment">
          <button
            type="button"
            className={`xoptions-stepper__node ${step.n === currentStep ? "xoptions-stepper__node--current" : ""} ${step.n < currentStep ? "xoptions-stepper__node--complete" : ""} ${step.n > currentStep ? "xoptions-stepper__node--future" : ""}`}
            aria-current={step.n === currentStep ? "step" : undefined}
            disabled={step.n > unlockedStep}
            onClick={() => onStepSelect(step.n)}
          >
            <span className="xoptions-stepper__node-num">{step.n}</span>
            <span className="xoptions-stepper__node-label">{step.title}</span>
          </button>
          {index < steps.length - 1 ? <span className="xoptions-stepper__rail" aria-hidden /> : null}
        </div>
      ))}
    </nav>
  );
}

function CompactStepperProgress({
  currentStep,
  total,
  progressPct
}: {
  currentStep: number;
  total: number;
  progressPct: number;
}) {
  return (
    <div className="xoptions-stepper xoptions-stepper--compact" aria-label="Strategy builder progress">
      <p className="xoptions-stepper__compact-label m-0 text-[0.72rem] font-semibold text-[var(--xf-text-200)]">
        Step {currentStep} of {total}
      </p>
      <div
        className="xoptions-stepper__progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPct)}
      >
        <div className="xoptions-stepper__progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}
