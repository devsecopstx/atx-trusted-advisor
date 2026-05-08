"use client";

import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode
} from "react";

export type SidebarDestructiveVariant = "destructive-soft" | "destructive";

export type SidebarDestructiveActionProps = {
  icon: ReactNode;
  label: string;
  /** Icon-only trigger (e.g. collapsed workspace rail). */
  compact?: boolean;
  confirmTitle: string;
  confirmMessage: string;
  confirmActionLabel: string;
  cancelLabel?: string;
  ariaLabel: string;
  onConfirm: () => void | Promise<void>;
  variant?: SidebarDestructiveVariant;
  /** Parent-driven open (e.g. global shortcut). */
  openSignal?: boolean;
  onOpenSignalConsumed?: () => void;
};

export function SidebarDestructiveAction({
  icon,
  label,
  compact = false,
  confirmTitle,
  confirmMessage,
  confirmActionLabel,
  cancelLabel = "Cancel",
  ariaLabel,
  onConfirm,
  variant = "destructive-soft",
  openSignal = false,
  onOpenSignalConsumed
}: SidebarDestructiveActionProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openSignal) {
      return;
    }
    setConfirmOpen(true);
    setError(null);
    onOpenSignalConsumed?.();
  }, [openSignal, onOpenSignalConsumed]);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }
    function onDocKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setConfirmOpen(false);
      }
    }
    document.addEventListener("keydown", onDocKey);
    queueMicrotask(() => cancelRef.current?.focus());
    return () => document.removeEventListener("keydown", onDocKey);
  }, [confirmOpen]);

  const runConfirm = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [onConfirm]);

  function onTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setConfirmOpen(true);
      setError(null);
    }
  }

  const triggerMods = [
    "sidebar-destructive-action__trigger",
    variant === "destructive" ? "sidebar-destructive-action__trigger--strong" : "",
    compact ? "sidebar-destructive-action__trigger--compact" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="sidebar-destructive-action">
      <button
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={triggerMods}
        type="button"
        onClick={() => {
          setConfirmOpen(true);
          setError(null);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="sidebar-destructive-action__trigger-icon">{icon}</span>
        <span className={`sidebar-destructive-action__trigger-label${compact ? " sr-only" : ""}`}>{label}</span>
      </button>

      {confirmOpen ? (
        <div
          aria-labelledby={titleId}
          aria-describedby={descId}
          aria-modal="true"
          className="sidebar-destructive-action__backdrop"
          role="alertdialog"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmOpen(false);
            }
          }}
        >
          <div className="sidebar-destructive-action__dialog">
            <h2 className="sidebar-destructive-action__title" id={titleId}>
              {confirmTitle}
            </h2>
            <p className="sidebar-destructive-action__desc" id={descId}>
              {confirmMessage}
            </p>
            {error ? <p className="sidebar-destructive-action__err">{error}</p> : null}
            <div className="sidebar-destructive-action__actions">
              <button
                ref={cancelRef}
                className="sidebar-destructive-action__btn sidebar-destructive-action__btn--ghost"
                disabled={busy}
                type="button"
                onClick={() => setConfirmOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                className="sidebar-destructive-action__btn sidebar-destructive-action__btn--danger"
                disabled={busy}
                type="button"
                onClick={() => void runConfirm()}
              >
                {busy ? "Signing out…" : confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
