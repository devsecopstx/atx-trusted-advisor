"use client";

import { useEffect, useId, useRef, useState } from "react";

import { XfThemePreferenceMenu } from "@/app/ui/public-theme-picker";

function UserMenuGlyph() {
  return (
    <svg aria-hidden className="xchat-guest-menu-trigger__svg" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

/**
 * Guest xChat header: single control opens appearance (and future sign-in links).
 */
export function XchatGuestHeaderMenu() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const t = event.target;
      if (!(t instanceof Node) || !rootRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="xchat-guest-menu" ref={rootRef}>
      <button
        aria-controls={`${id}-panel`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Menu: appearance"
        className="xchat-guest-menu-trigger"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <UserMenuGlyph />
      </button>
      {open ? (
        <div
          className="admin-session-popover xchat-guest-menu-popover"
          id={`${id}-panel`}
          role="dialog"
          aria-label="Guest menu"
        >
          <p className="admin-session-popover__eyebrow">Appearance</p>
          <XfThemePreferenceMenu onCommitted={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
