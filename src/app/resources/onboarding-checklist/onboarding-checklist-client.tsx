"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";

import {
    ONBOARDING_CHECKLIST_ESTIMATED_MINUTES,
    ONBOARDING_CHECKLIST_STEPS,
    ONBOARDING_CHECKLIST_TOTAL_STEPS,
    getNextOnboardingStep,
    type OnboardingChecklistStepId,
} from "@/lib/onboarding/onboarding-checklist-steps";
import {
    readOnboardingChecklistState,
    toggleOnboardingStepCompletion,
} from "@/lib/onboarding/onboarding-checklist-storage";
import { writeXchatPendingComposerHandoff } from "@/lib/xchat/xchat-pending-prompt";

import "./onboarding-checklist.css";

type OnboardingChecklistClientProps = {
  userId: string | null;
};

function useMobileAccordion(defaultExpandedId: OnboardingChecklistStepId): {
  isMobile: boolean;
  expandedStepId: OnboardingChecklistStepId;
  toggleAccordion: (stepId: OnboardingChecklistStepId) => void;
} {
  const [isMobile, setIsMobile] = useState(false);
  const [expandedStepId, setExpandedStepId] =
    useState<OnboardingChecklistStepId>(defaultExpandedId);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleAccordion = useCallback((stepId: OnboardingChecklistStepId) => {
    setExpandedStepId((prev) => (prev === stepId ? prev : stepId));
  }, []);

  return { isMobile, expandedStepId, toggleAccordion };
}

export function OnboardingChecklistClient({ userId }: OnboardingChecklistClientProps) {
  const reduceMotion = useReducedMotion();
  const [completedStepIds, setCompletedStepIds] = useState<OnboardingChecklistStepId[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { isMobile, expandedStepId, toggleAccordion } = useMobileAccordion("portfolio-foundation");

  useEffect(() => {
    const state = readOnboardingChecklistState(userId);
    setCompletedStepIds(state.completedStepIds);
    setHydrated(true);
  }, [userId]);

  const completedSet = useMemo(() => new Set(completedStepIds), [completedStepIds]);
  const completedCount = completedStepIds.length;
  const progressRatio =
    ONBOARDING_CHECKLIST_TOTAL_STEPS > 0 ? completedCount / ONBOARDING_CHECKLIST_TOTAL_STEPS : 0;

  const handleToggleStep = useCallback(
    (stepId: OnboardingChecklistStepId, checked: boolean) => {
      const next = toggleOnboardingStepCompletion(userId, stepId, checked);
      setCompletedStepIds(next);
    },
    [userId],
  );

  const handleCtaClick = useCallback(
    (seedPrompt?: string, personaName?: string) => {
      if (!seedPrompt?.trim()) {
        return;
      }
      writeXchatPendingComposerHandoff({ prompt: seedPrompt, personaName });
    },
    [],
  );

  return (
    <article className="onboarding-checklist-shell" aria-label="Institutional onboarding checklist">
      <header className="onboarding-checklist-hero">
        <div className="onboarding-checklist-hero__badge-row">
          <span className="onboarding-checklist-hero__badge">Private Client</span>
          <span className="onboarding-checklist-hero__badge">Institutional Onboarding</span>
        </div>
        <p className="onboarding-checklist-hero__eyebrow">Resources · Capital stewardship</p>
        <h1 className="onboarding-checklist-hero__title">Institutional onboarding foundations</h1>
        <p className="onboarding-checklist-hero__copy">
          Seven foundations move your workspace from generic suggestions to institutional-grade,
          context-aware capital allocation frameworks — tax-efficient, liquidity-aware, and
          legacy-integrated across every custodian and sleeve you steward.
        </p>
        <p className="onboarding-checklist-fiduciary-note" role="note">
          Fiduciary note: This sequence describes educational product workflows for sophisticated
          capital stewards. It is not individualized investment, tax, or legal advice. All
          recommendations remain subject to your stated mandate, custodian records, and applicable
          regulatory constraints.
        </p>
      </header>

      <div className="onboarding-checklist-progress" aria-live="polite">
        <div
          className="onboarding-checklist-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={ONBOARDING_CHECKLIST_TOTAL_STEPS}
          aria-valuenow={completedCount}
          aria-label="Onboarding foundations completed"
        >
          <motion.div
            className="onboarding-checklist-progress__fill"
            initial={false}
            animate={{ width: `${Math.round(progressRatio * 100)}%` }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
            }
          />
        </div>
        <p className="onboarding-checklist-progress__meta">
          {hydrated ? (
            <>
              {completedCount} of {ONBOARDING_CHECKLIST_TOTAL_STEPS} foundations complete — estimated
              time to full activation: {ONBOARDING_CHECKLIST_ESTIMATED_MINUTES} minutes
            </>
          ) : (
            <>Loading your onboarding progress…</>
          )}
        </p>
      </div>

      <nav className="onboarding-checklist-rail" aria-label="Onboarding progress">
        {ONBOARDING_CHECKLIST_STEPS.map((step) => {
          const complete = completedSet.has(step.id as OnboardingChecklistStepId);
          const active = expandedStepId === step.id;
          return (
            <a
              key={step.id}
              href={`#${step.id}`}
              className={[
                "onboarding-checklist-rail__item",
                complete ? "onboarding-checklist-rail__item--complete" : "",
                active ? "onboarding-checklist-rail__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="onboarding-checklist-rail__dot" aria-hidden="true">
                {complete ? "✓" : step.number}
              </span>
              <span>{step.navLabel}</span>
            </a>
          );
        })}
      </nav>

      {ONBOARDING_CHECKLIST_STEPS.map((step) => {
        const stepId = step.id as OnboardingChecklistStepId;
        const isComplete = completedSet.has(stepId);
        const nextStep = getNextOnboardingStep(stepId);
        const bodyCollapsed = isMobile && expandedStepId !== stepId;
        const headerAccordion = isMobile;

        return (
          <section
            key={step.id}
            id={step.id}
            className={[
              "onboarding-checklist-step",
              isComplete ? "onboarding-checklist-step--complete" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={[
                "onboarding-checklist-step__header",
                headerAccordion ? "onboarding-checklist-step__header--accordion" : "",
                bodyCollapsed ? "onboarding-checklist-step__header--collapsed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              {...(headerAccordion
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    "aria-expanded": !bodyCollapsed,
                    onClick: () => toggleAccordion(stepId),
                    onKeyDown: (event: KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleAccordion(stepId);
                      }
                    },
                  }
                : {})}
            >
              <input
                type="checkbox"
                className="onboarding-checklist-step__checkbox"
                checked={isComplete}
                aria-label={`Mark foundation ${step.number} complete: ${step.title}`}
                onChange={(event) => {
                  event.stopPropagation();
                  handleToggleStep(stepId, event.target.checked);
                }}
                onClick={(event) => event.stopPropagation()}
              />
              <div className="onboarding-checklist-step__heading-block">
                <p className="onboarding-checklist-step__number">Foundation {step.number}</p>
                <h2 className="onboarding-checklist-step__title">{step.title}</h2>
              </div>
              {headerAccordion ? (
                <span
                  className={[
                    "onboarding-checklist-step__chevron",
                    !bodyCollapsed ? "onboarding-checklist-step__chevron--open" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                >
                  ▾
                </span>
              ) : null}
            </div>

            <div
              className={[
                "onboarding-checklist-step__body",
                bodyCollapsed ? "onboarding-checklist-step__body--collapsed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <p className="onboarding-checklist-step__desc">{step.description}</p>

              <aside className="onboarding-checklist-step__fo-note">
                <p className="onboarding-checklist-step__fo-label">
                  Why this matters for complex wealth
                </p>
                <p className="onboarding-checklist-step__fo-copy">{step.familyOfficeNote}</p>
              </aside>

              <ul className="onboarding-checklist-step__actions">
                {step.actions.map((action) => (
                  <li key={action.label} className="onboarding-checklist-step__action">
                    <span className="onboarding-checklist-step__action-label">{action.label}</span>
                    <span className="onboarding-checklist-step__action-detail">{action.detail}</span>
                  </li>
                ))}
              </ul>

              <p className="onboarding-checklist-step__impact">{step.impactLine}</p>

              <div className="onboarding-checklist-step__cta-row">
                {step.cta.seedPrompt ? (
                  <Link
                    href={step.cta.href}
                    className="onboarding-checklist-step__cta"
                    onClick={() => handleCtaClick(step.cta.seedPrompt, step.cta.personaName)}
                  >
                    {step.cta.label}
                  </Link>
                ) : (
                  <Link href={step.cta.href} className="onboarding-checklist-step__cta">
                    {step.cta.label}
                  </Link>
                )}
                {isComplete && nextStep ? (
                  <a
                    href={`#${nextStep.id}`}
                    className="onboarding-checklist-step__advance"
                    onClick={() => {
                      if (isMobile) {
                        toggleAccordion(nextStep.id as OnboardingChecklistStepId);
                      }
                    }}
                  >
                    Advance to next foundation →
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      <section className="onboarding-checklist-final-cta" aria-labelledby="institutional-workspace-cta">
        <h2 id="institutional-workspace-cta" className="onboarding-checklist-final-cta__title">
          Your institutional workspace awaits
        </h2>
        <p className="onboarding-checklist-final-cta__copy">
          Complete these foundations to unlock the full power of your advisory stack — real-time
          xOptions strategy builder, xAI multi-agent synthesis, IBKR execution parity, and a
          consolidated family-office view across every sleeve you steward.
        </p>
        <ul className="onboarding-checklist-final-cta__features">
          <li>Real-time xOptions strategy builder</li>
          <li>xAI multi-agent advisory</li>
          <li>IBKR execution parity</li>
          <li>Consolidated family-office view</li>
        </ul>
        <Link href="/xchat" className="onboarding-checklist-final-cta__link">
          Enter institutional workspace
        </Link>
      </section>

      <p className="onboarding-checklist-trust-bar">
        SOC 2 Type II · Audit-logged · Fiduciary-aware architecture · Designed for
        multi-generational wealth
      </p>

      <p className="onboarding-checklist-disclaimer">
        Options involve risk and may not be suitable for all investors. This checklist describes
        product workflows only; it is not an offer or recommendation to buy or sell any security.
      </p>
    </article>
  );
}
