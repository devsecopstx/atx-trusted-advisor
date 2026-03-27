"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
    DEFAULT_XF_UI_THEME_PREFERENCE,
    XF_UI_THEME_STORAGE_KEY,
    applyXfUiToDocument,
    dispatchXfUiThemeChange,
    getXfUiThemePreferenceSnapshot,
    subscribeXfUiThemePreference,
    type XfUiThemePreference
} from "@/lib/xf-ui-theme";

const OPTIONS: { value: XfUiThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Softer dark surfaces (still dark mode)" },
  { value: "dark", label: "Dark", hint: "Deep black-forward contrast" },
  { value: "system", label: "System", hint: "Match device light/dark for soft vs deep dark" }
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

type PublicThemePickerProps = {
  /** `xchat` = product header chrome; `admin` = admin topbar sizing */
  variant?: "xchat" | "admin";
};

export function PublicThemePicker({ variant = "xchat" }: PublicThemePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const choose = useCallback((next: XfUiThemePreference) => {
    try {
      window.localStorage.setItem(XF_UI_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
    applyXfUiToDocument(next);
    dispatchXfUiThemeChange();
    setOpen(false);
  }, []);

  const btnClass =
    variant === "admin"
      ? "xf-theme-picker-trigger xf-theme-picker-trigger--admin"
      : "xf-theme-picker-trigger xf-theme-picker-trigger--xchat";

  return (
    <div className="xf-theme-picker-root" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Theme: appearance (dark surfaces)"
        className={btnClass}
        title="Theme: Light (soft dark), Dark, or System"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <MoonIcon />
      </button>
      {open ? (
        <div className="xf-theme-picker-menu" role="menu" aria-label="Theme">
          {OPTIONS.map((opt) => {
            const selected = pref === opt.value;
            return (
              <button
                key={opt.value}
                className={`xf-theme-picker-item${selected ? " xf-theme-picker-item--active" : ""}`}
                role="menuitemradio"
                aria-checked={selected}
                title={opt.hint}
                type="button"
                onClick={() => choose(opt.value)}
              >
                <span className="xf-theme-picker-item__label">{opt.label}</span>
                {selected ? <CheckIcon className="xf-theme-picker-item__check" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
