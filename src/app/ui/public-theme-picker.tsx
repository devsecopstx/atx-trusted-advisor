"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import {
    DEFAULT_XF_UI_THEME_PREFERENCE,
    XF_UI_THEME_STORAGE_KEY,
    applyXfUiToDocument,
    dispatchXfUiThemeChange,
    getXfUiThemePreferenceSnapshot,
    subscribeXfUiThemePreference,
    type XfUiThemePreference
} from "@/lib/xf-ui-theme";

export const THEME_OPTIONS: { value: XfUiThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Softer charcoal surfaces" },
  { value: "dark", label: "Dark", hint: "Deep black-forward contrast" },
  { value: "system", label: "System", hint: "Match device for soft vs deep" }
];

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M21 14.5A8.5 8.5 0 0111.5 5a8.45 8.45 0 013.14 6.32 3.5 3.5 0 00-4.18 4.18A8.5 8.5 0 0021 14.5z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="14" viewBox="0 0 24 24" width="14">
      <path d="M5 12l4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
    </svg>
  );
}

/** Shared preference sync + persistence for shell theme (soft vs deep). */
export function useXfShellTheme() {
  const pref = useSyncExternalStore(
    subscribeXfUiThemePreference,
    getXfUiThemePreferenceSnapshot,
    () => DEFAULT_XF_UI_THEME_PREFERENCE
  );

  useEffect(() => {
    applyXfUiToDocument(pref);
  }, [pref]);

  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onScheme = () => {
      applyXfUiToDocument("system");
    };
    onScheme();
    mq.addEventListener("change", onScheme);
    return () => mq.removeEventListener("change", onScheme);
  }, [pref]);

  const setPreference = useCallback((next: XfUiThemePreference) => {
    try {
      window.localStorage.setItem(XF_UI_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
    applyXfUiToDocument(next);
    dispatchXfUiThemeChange();
    void fetch("/api/user/appearance", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xfUiTheme: next })
    }).catch(() => {
      /* offline / guest session — local theme still applies */
    });
  }, []);

  return { pref, setPreference };
}

type XfThemePreferenceMenuProps = {
  /** Called after user picks a theme (e.g. close parent popover). */
  onCommitted?: () => void;
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

/**
 * Inline appearance control for account/profile menus (no separate moon icon).
 */
export function XfThemePreferenceMenu({
  onCommitted,
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel
}: XfThemePreferenceMenuProps) {
  const { pref, setPreference } = useXfShellTheme();

  const pick = useCallback(
    (next: XfUiThemePreference) => {
      setPreference(next);
      onCommitted?.();
    },
    [onCommitted, setPreference]
  );

  return (
    <div
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : "Appearance")}
      aria-labelledby={ariaLabelledBy}
      className={className ?? "xf-theme-inline-menu"}
      role="radiogroup"
    >
      {THEME_OPTIONS.map((opt) => {
        const selected = pref === opt.value;
        return (
          <button
            key={opt.value}
            aria-checked={selected}
            className={`xf-theme-inline-menu__item${selected ? " xf-theme-inline-menu__item--active" : ""}`}
            role="radio"
            type="button"
            onClick={() => pick(opt.value)}
          >
            <span className="xf-theme-inline-menu__text">
              <span className="xf-theme-inline-menu__label">{opt.label}</span>
              <span className="xf-theme-inline-menu__hint">{opt.hint}</span>
            </span>
            {selected ? <CheckIcon className="xf-theme-inline-menu__check" /> : null}
          </button>
        );
      })}
    </div>
  );
}

type PublicThemePickerProps = {
  /** `xchat` = product header chrome; `admin` = admin topbar sizing */
  variant?: "xchat" | "admin";
};

/** Standalone moon trigger + dropdown (use sparingly; prefer {@link XfThemePreferenceMenu} in profile menus). */
export function PublicThemePicker({ variant = "xchat" }: PublicThemePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { pref, setPreference } = useXfShellTheme();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menuClass =
    variant === "admin"
      ? "xf-theme-picker-menu xf-theme-picker-menu--admin"
      : "xf-theme-picker-menu";

  const btnClass =
    variant === "admin"
      ? "xf-theme-picker-trigger xf-theme-picker-trigger--admin"
      : "xf-theme-picker-trigger xf-theme-picker-trigger--xchat";

  const triggerHint =
    variant === "admin" ? "Theme: Light, Dark, or System" : "Theme: Light (soft dark), Dark, or System";

  return (
    <div className="xf-theme-picker-root" ref={rootRef}>
      <XfHoverHint hint={triggerHint}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Theme: appearance (dark surfaces)"
          className={btnClass}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <MoonIcon />
        </button>
      </XfHoverHint>
      {open ? (
        <div className={menuClass} role="menu" aria-label="Theme">
          {THEME_OPTIONS.map((opt) => {
            const selected = pref === opt.value;
            const row = (
              <button
                aria-checked={selected}
                className={`xf-theme-picker-item${selected ? " xf-theme-picker-item--active" : ""}`}
                role="menuitemradio"
                type="button"
                onClick={() => {
                  setPreference(opt.value);
                  setOpen(false);
                }}
              >
                <span className="xf-theme-picker-item__text-stack">
                  <span className="xf-theme-picker-item__label">{opt.label}</span>
                  {variant === "admin" ? (
                    <span className="xf-theme-picker-item__hint">{opt.hint}</span>
                  ) : null}
                </span>
                {selected ? <CheckIcon className="xf-theme-picker-item__check" /> : null}
              </button>
            );
            return (
              <Fragment key={opt.value}>
                {variant === "xchat" ? <XfHoverHint hint={opt.hint}>{row}</XfHoverHint> : row}
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
