"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { XCHAT_SJP_LAST_CHOICE_KEY, type XchatSjpLastChoice } from "@/lib/xchat-strategy-job-handoff";
import { xchatWorkspaceHandoffHref } from "@/lib/xchat/xchat-workspace-handoff-href";

const FULL_DISCLAIMER_VERBATIM =
  "Not investment advice. Options involve substantial risk; review suitability, liquidity, assignment risk, and tax impact before execution.";

const RISK_LINE_ALWAYS =
  "Options involve substantial risk of loss. Not investment advice. Review suitability with your advisor.";

export type XchatStrategyJobPreflightProps = {
  loading: boolean;
  launchBusy: boolean;
  emphasizePrimary: boolean;
  workspacePortfolioId?: string | null;
  onLaunch: () => void;
  onStayInChat: () => void;
};

export function XchatStrategyJobPreflightCards({
  loading,
  launchBusy,
  emphasizePrimary,
  workspacePortfolioId = null,
  onLaunch,
  onStayInChat
}: XchatStrategyJobPreflightProps) {
  const xoptionsHref = xchatWorkspaceHandoffHref("/xoptions", workspacePortfolioId);
  const xstrategyHref = xchatWorkspaceHandoffHref("/xstrategybuilder", workspacePortfolioId);
  const headingId = useId();
  const [lastChoice, setLastChoice] = useState<XchatSjpLastChoice | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(XCHAT_SJP_LAST_CHOICE_KEY);
      return raw === "launch" || raw === "stay" ? raw : null;
    } catch {
      return null;
    }
  });

  const persistChoice = (choice: XchatSjpLastChoice) => {
    try {
      sessionStorage.setItem(XCHAT_SJP_LAST_CHOICE_KEY, choice);
      setLastChoice(choice);
    } catch {
      // ignore
    }
  };

  const resetDefault = () => {
    try {
      sessionStorage.removeItem(XCHAT_SJP_LAST_CHOICE_KEY);
      setLastChoice(null);
    } catch {
      // ignore
    }
  };

  const primaryRing =
    emphasizePrimary || lastChoice === "launch" ? " xchat-sjp__card--suggested" : "";
  const secondaryRing = lastChoice === "stay" ? " xchat-sjp__card--suggested" : "";

  const busy = loading || launchBusy;

  return (
    <section
      aria-labelledby={headingId}
      className="xchat-sjp"
    >
      <h3 className="xchat-sjp__title" id={headingId}>
        How would you like to continue?
      </h3>
      <p className="xchat-sjp__lede">
        Your question fits a structured options-income workflow. Pick the path that matches how much formality you want
        right now.
      </p>

      <div className="xchat-sjp__grid">
        <article className={`xchat-sjp__card xchat-sjp__card--primary${primaryRing}`}>
          <div className="xchat-sjp__card-head">
            <span aria-hidden className="xchat-sjp__icon">
              📋
            </span>
            <div>
              <h4 className="xchat-sjp__card-title">Launch Structured Strategy Job</h4>
              <p className="xchat-sjp__card-sub">Recommended for formal planning</p>
            </div>
          </div>
          <ul className="xchat-sjp__bullets">
            <li>Full desk context collected</li>
            <li>Produces auditable Markdown + JSON artifact</li>
            <li>Seamless handoff to xStrategyBuilder</li>
          </ul>
          <button
            aria-busy={busy}
            aria-label="Launch structured strategy job. Sends launch strategy job to advisor."
            className="xchat-sjp__btn xchat-sjp__btn--primary"
            disabled={busy}
            onClick={() => {
              persistChoice("launch");
              onLaunch();
            }}
            type="button"
          >
            {launchBusy ? "Starting…" : "Launch Strategy Job →"}
          </button>
          <p className="xchat-sjp__advanced-link-wrap">
            <Link className="xchat-sjp__advanced-link" href={xstrategyHref} prefetch={false}>
              Open in xStrategyBuilder (advanced)
            </Link>
            {" · "}
            <Link className="xchat-sjp__advanced-link" href={xoptionsHref} prefetch={false}>
              xOptions desk
            </Link>
          </p>
        </article>

        <article className={`xchat-sjp__card${secondaryRing}`}>
          <div className="xchat-sjp__card-head">
            <span aria-hidden className="xchat-sjp__icon">
              💬
            </span>
            <div>
              <h4 className="xchat-sjp__card-title">Stay in Educational Chat</h4>
              <p className="xchat-sjp__card-sub">Quick concepts and risk overview</p>
            </div>
          </div>
          <ul className="xchat-sjp__bullets">
            <li>High-level options education only</li>
            <li>No formal artifact or handoff</li>
          </ul>
          <button
            aria-busy={busy}
            aria-label="Continue in educational chat only. Sends stay in chat to advisor."
            className="xchat-sjp__btn xchat-sjp__btn--outline"
            disabled={busy}
            onClick={() => {
              persistChoice("stay");
              onStayInChat();
            }}
            type="button"
          >
            Continue in Chat
          </button>
        </article>
      </div>

      <p className="xchat-sjp__risk-line">{RISK_LINE_ALWAYS}</p>

      <details className="xchat-sjp__details">
        <summary className="xchat-sjp__details-summary">Full risk and suitability notice</summary>
        <p className="xchat-sjp__details-body">{FULL_DISCLAIMER_VERBATIM}</p>
      </details>

      {lastChoice ? (
        <p className="xchat-sjp__session-pref">
          <button className="xchat-sjp__session-reset" onClick={resetDefault} type="button">
            Reset default for this session
          </button>
        </p>
      ) : null}
    </section>
  );
}
