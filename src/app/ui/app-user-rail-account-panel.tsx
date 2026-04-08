"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SendIcon, XMarkIcon } from "@/app/admin/ui/crud-icons";
import { GoogleGIcon } from "@/app/ui/oauth-provider-icons";
import { XfThemePreferenceMenu } from "@/app/ui/public-theme-picker";
import { PwaInstallAccountPrompt } from "@/app/ui/pwa-install-account-prompt";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { tenantIdHexLastFourUserFacing } from "@/lib/mongo-object-id-hex";
import { USER_FEEDBACK_OPEN_EVENT } from "@/lib/user-feedback-open-event";

export type AppUserRailAccountPanelDetails = {
  email: string;
  username: string;
  displayName?: string;
  xUserId: string;
  avatarUrl?: string;
  mongoConnection?: string;
  /** Session `core_tenants` ObjectId hex; UI shows last 4 chars only (`···` prefix); full id in `title`. */
  tenantIdHex?: string;
  isGlobalAdmin: boolean;
};

type AppUserRailAccountPanelProps = {
  details: AppUserRailAccountPanelDetails;
  /** Overrides pathname-derived label for feedback API `page` field. */
  feedbackPageLabel?: string;
  /** When set, adds “Link Google” (same verified email as profile) for X-first sign-in. */
  googleLinkHref?: string | null;
};

export function AppUserRailAccountPanel({
  details,
  feedbackPageLabel,
  googleLinkHref = null
}: AppUserRailAccountPanelProps) {
  const pathname = usePathname() ?? "";
  const pageLabel = feedbackPageLabel?.trim() || pathname || "App";

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [logoutStatus, setLogoutStatus] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const feedbackDialogRef = useRef<HTMLDivElement | null>(null);

  async function handleLogout() {
    setLogoutStatus("");
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      window.location.href = "/xchat";
    } catch (error) {
      setLogoutStatus(error instanceof Error ? error.message : "Logout failed");
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = feedbackText.trim();
    if (trimmed.length < 3) {
      setFeedbackStatus("Please enter at least 3 characters.");
      return;
    }
    setFeedbackStatus("");
    setIsSendingFeedback(true);
    try {
      const response = await fetch("/api/user-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          page: pageLabel
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send feedback");
      }
      setFeedbackText("");
      setFeedbackOpen(false);
      setFeedbackStatus("Thanks — feedback received.");
      window.setTimeout(() => setFeedbackStatus(""), 4000);
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? error.message : "Send failed");
    } finally {
      setIsSendingFeedback(false);
    }
  }

  useEffect(() => {
    if (!feedbackOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFeedbackOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedbackOpen]);

  useEffect(() => {
    function onOpenFeedback() {
      setFeedbackStatus("");
      setFeedbackOpen(true);
    }
    window.addEventListener(USER_FEEDBACK_OPEN_EVENT, onOpenFeedback);
    return () => window.removeEventListener(USER_FEEDBACK_OPEN_EVENT, onOpenFeedback);
  }, []);

  const { email, username, displayName, xUserId, mongoConnection, tenantIdHex, isGlobalAdmin } = details;
  const mongoHref =
    mongoConnection && mongoConnection.includes("://")
      ? mongoConnection
      : mongoConnection
        ? `mongodb://${mongoConnection}`
        : null;
  const tenantTrimmed = tenantIdHex?.trim() ?? "";
  const tenantPreview = tenantTrimmed ? tenantIdHexLastFourUserFacing(tenantTrimmed) : "";
  const showDatabaseDisclosure = Boolean((mongoConnection && mongoHref) || tenantTrimmed);

  return (
    <div className="app-user-rail-account-panel">
      <div className="app-user-rail-account-panel__identity">
        <div className="app-user-rail-account-panel__identity-text">
          <p className="app-user-rail-account-panel__name">{displayName ?? username}</p>
          <p className="app-user-rail-account-panel__handle">@{username}</p>
        </div>
      </div>

      <p className="app-user-rail-account-panel__meta">
        <span className="app-user-rail-account-panel__meta-k">Email</span>
        <span className="app-user-rail-account-panel__meta-v">{email}</span>
      </p>
      <p className="app-user-rail-account-panel__meta">
        <span className="app-user-rail-account-panel__meta-k">X user id</span>
        <span className="app-user-rail-account-panel__meta-v font-mono text-[0.65rem]">{xUserId}</span>
      </p>
      {showDatabaseDisclosure ? (
        <details className="app-user-rail-account-panel__db">
          <summary className="app-user-rail-account-panel__db-summary">
            <span className="app-user-rail-account-panel__meta-k">Database</span>
            {tenantPreview ? (
              <span
                className="app-user-rail-account-panel__db-tenant-redacted font-mono"
                title={tenantTrimmed ? `Tenant id ${tenantTrimmed}` : undefined}
              >
                Tenant {tenantPreview}
              </span>
            ) : null}
          </summary>
          <div className="app-user-rail-account-panel__db-body">
            {mongoConnection && mongoHref ? (
              <a className="app-user-rail-account-panel__code app-user-rail-account-panel__code-link" href={mongoHref}>
                {mongoConnection}
              </a>
            ) : null}
            {tenantTrimmed ? (
              <p className="app-user-rail-account-panel__meta app-user-rail-account-panel__meta--tenant-id">
                <span className="app-user-rail-account-panel__meta-k">Tenant id</span>
                <span
                  className="app-user-rail-account-panel__meta-v font-mono text-[0.65rem] break-all"
                  title={tenantTrimmed}
                >
                  {tenantIdHexLastFourUserFacing(tenantTrimmed)}
                </span>
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      <nav className="app-user-rail-account-panel__nav" aria-label="Account shortcuts">
        {isGlobalAdmin ? (
          <Link className="app-user-rail-sublink" href="/admin/manage_account">
            Settings
          </Link>
        ) : (
          <span className="app-user-rail-sublink app-user-rail-sublink--muted" role="note" tabIndex={0}>
            Settings (Hub admin)
          </span>
        )}
        {googleLinkHref ? (
          <XfHoverHint hint="Uses the same verified email as your xFinance profile ($2/hr usage unchanged).">
            <Link className="app-user-rail-sublink app-user-rail-sublink--oauth" href={googleLinkHref}>
              <GoogleGIcon className="inline-block align-[-0.12em] opacity-90" size={14} />
              <span className="ml-1">Link Google</span>
            </Link>
          </XfHoverHint>
        ) : null}
        <Link className="app-user-rail-sublink" href="/account/billing">
          Plans &amp; billing
        </Link>
        <Link className="app-user-rail-sublink" href="/legal/terms">
          Legal
        </Link>
        <PwaInstallAccountPrompt />
      </nav>

      <details className="app-user-rail-account-panel__appearance">
        <summary className="app-user-rail-account-panel__appearance-summary">Appearance</summary>
        <div className="app-user-rail-account-panel__appearance-body">
          <XfThemePreferenceMenu aria-label="Appearance theme" />
        </div>
      </details>

      <div className="app-user-rail-account-panel__actions">
        <button
          className="app-user-rail-account-panel__btn"
          type="button"
          onClick={() => {
            setFeedbackStatus("");
            setFeedbackOpen(true);
          }}
        >
          Submit feedback
        </button>
        <button
          className="app-user-rail-account-panel__btn app-user-rail-account-panel__btn--logout"
          disabled={isLoggingOut}
          type="button"
          onClick={() => void handleLogout()}
        >
          {isLoggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>

      {logoutStatus ? <p className="status-text status-error text-[0.7rem]">{logoutStatus}</p> : null}
      {feedbackStatus && !feedbackOpen ? (
        <p className="status-text text-[0.7rem] text-[var(--xf-gain-green)]">{feedbackStatus}</p>
      ) : null}

      {feedbackOpen ? (
        <div
          aria-labelledby="rail-feedback-title"
          aria-modal="true"
          className="xchat-feedback-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setFeedbackOpen(false);
            }
          }}
          role="dialog"
        >
          <div className="xchat-feedback-dialog" ref={feedbackDialogRef}>
            <h2 className="xchat-feedback-title" id="rail-feedback-title">
              Submit feedback
            </h2>
            <p className="xchat-feedback-hint">
              Tell us what broke, what to improve, or what you need next. Optional Slack delivery when configured
              server-side.
            </p>
            <form className="xchat-feedback-form" onSubmit={(e) => void handleFeedbackSubmit(e)}>
              <textarea
                className="xchat-feedback-textarea"
                maxLength={4000}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Your message…"
                rows={5}
                value={feedbackText}
              />
              {feedbackStatus && feedbackOpen ? (
                <p className={`status-text${feedbackStatus.includes("Thanks") ? "" : " status-error"}`}>
                  {feedbackStatus}
                </p>
              ) : null}
              <div className="xchat-feedback-actions">
                <button
                  className="cta cta-secondary"
                  disabled={isSendingFeedback}
                  onClick={() => {
                    setFeedbackOpen(false);
                    setFeedbackStatus("");
                  }}
                  type="button"
                >
                  <XMarkIcon className="crud-icon" />
                  Cancel
                </button>
                <button className="cta cta-primary" disabled={isSendingFeedback} type="submit">
                  <SendIcon className="crud-icon" />
                  {isSendingFeedback ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
