"use client";

import { SendIcon, XMarkIcon } from "@/app/admin/ui/crud-icons";
import { USER_FEEDBACK_OPEN_EVENT } from "@/lib/user-feedback-open-event";
import { type FormEvent, useEffect, useRef, useState } from "react";

export type RailUserFeedbackDialogProps = {
  /** Overrides pathname-derived label for feedback API `page` field. */
  pageLabel: string;
};

/** Listens for `USER_FEEDBACK_OPEN_EVENT` and renders the modal feedback composer (workspace rail + billing links). */
export function RailUserFeedbackDialog({ pageLabel }: RailUserFeedbackDialogProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const feedbackDialogRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <>
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
    </>
  );
}
