"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

type AppUserHeaderSessionProps = {
  mongoConnection: string;
  email: string;
  username: string;
  displayName?: string;
  xUserId: string;
  avatarUrl?: string;
  feedbackPageLabel?: string;
};

export function AppUserHeaderSession({
  mongoConnection,
  email,
  username,
  displayName,
  xUserId,
  avatarUrl,
  feedbackPageLabel
}: AppUserHeaderSessionProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [logoutStatus, setLogoutStatus] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const profilePopoverId = useId();
  const profileRef = useRef<HTMLDivElement | null>(null);
  const feedbackDialogRef = useRef<HTMLDivElement | null>(null);

  async function handleLogout() {
    setLogoutStatus("");
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      window.location.href = "/";
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
          page: feedbackPageLabel
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
    if (!profileOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const t = event.target;
      if (!(t instanceof Node) || !profileRef.current?.contains(t)) {
        setProfileOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

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

  return (
    <div className="xchat-header-session">
      <div className="xchat-header-session-profile" ref={profileRef}>
        {avatarUrl ? (
          <Image
            alt={`${displayName ?? username} avatar`}
            className="xchat-header-session-avatar"
            height={28}
            src={avatarUrl}
            unoptimized
            width={28}
          />
        ) : (
          <span className="xchat-header-session-avatar xchat-header-session-avatar-fallback">
            {(displayName ?? username).slice(0, 1).toUpperCase()}
          </span>
        )}
        <button
          aria-controls={profilePopoverId}
          aria-expanded={profileOpen}
          aria-label="Profile and account"
          className="tiny-button xchat-header-session-btn xchat-header-session-btn--icon"
          onClick={() => setProfileOpen((v) => !v)}
          title="Profile"
          type="button"
        >
          <svg aria-hidden viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 16c0-2.6 2.7-4 6-4s6 1.4 6 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
          </svg>
        </button>
        {profileOpen ? (
          <div className="admin-session-popover xchat-header-profile-popover" id={profilePopoverId} role="dialog">
            <p>
              <strong>Name:</strong> {displayName ?? username}
            </p>
            <p>
              <strong>Username:</strong> @{username}
            </p>
            <p>
              <strong>Email:</strong> {email}
            </p>
            <p>
              <strong>X user id:</strong> {xUserId}
            </p>
            {mongoConnection ? (
              <p>
                <strong>Mongo (beta):</strong> <code className="xchat-header-code">{mongoConnection}</code>
              </p>
            ) : null}
            <div className="xchat-profile-menu" role="menu" aria-label="Account actions">
              <button
                className="xchat-profile-menu__item"
                role="menuitem"
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setFeedbackStatus("");
                  setFeedbackOpen(true);
                }}
              >
                Submit feedback
              </button>
              <button
                className="xchat-profile-menu__item xchat-profile-menu__item--logout"
                disabled={isLoggingOut}
                role="menuitem"
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  void handleLogout();
                }}
              >
                {isLoggingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {logoutStatus ? <span className="xchat-header-session-err">{logoutStatus}</span> : null}
      {feedbackStatus && !feedbackOpen ? (
        <span className="xchat-header-session-ok">{feedbackStatus}</span>
      ) : null}

      {feedbackOpen ? (
        <div
          aria-labelledby="xchat-feedback-title"
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
            <h2 className="xchat-feedback-title" id="xchat-feedback-title">
              Submit feedback
            </h2>
            <p className="xchat-feedback-hint">
              Tell us what broke, what to improve, or what you need next. Optional Slack delivery when
              configured server-side.
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
                  Cancel
                </button>
                <button className="cta cta-primary" disabled={isSendingFeedback} type="submit">
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
