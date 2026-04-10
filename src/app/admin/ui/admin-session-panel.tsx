"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { XfThemePreferenceMenu } from "@/app/ui/public-theme-picker";

type AdminSessionPanelProps = {
  username: string;
  email: string;
  displayName?: string;
  xUserId?: string;
  avatarUrl?: string;
  mongoConnection?: string;
};

export function AdminSessionPanel({
  username,
  email,
  displayName,
  xUserId,
  avatarUrl,
  mongoConnection
}: AdminSessionPanelProps) {
  const [status, setStatus] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const popoverId = useId();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  async function handleLogout() {
    setStatus("");
    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }
      window.location.href = "/xchat";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Logout failed");
    } finally {
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!popoverRef.current) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !popoverRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <div className="badge-wrap admin-session-panel">
      <div className="admin-session-identity" ref={popoverRef}>
        <button
          aria-controls={popoverId}
          aria-expanded={isMenuOpen}
          aria-label="Account, appearance, and sign out"
          className="admin-session-menu-trigger"
          data-hovertip="Account & appearance"
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {avatarUrl ? (
            <Image
              alt=""
              aria-hidden
              className="admin-session-avatar"
              height={38}
              src={avatarUrl}
              unoptimized
              width={38}
            />
          ) : (
            <span className="admin-session-avatar admin-session-avatar-fallback">
              {(displayName ?? username).slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        {isMenuOpen ? (
          <div className="admin-session-popover" id={popoverId} role="dialog" aria-label="Account menu">
            <p className="admin-session-popover__eyebrow">Signed in</p>
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
              <strong>XID:</strong> {xUserId ?? "unknown"}
            </p>
            {mongoConnection ? (
              <p>
                <strong>Mongo:</strong> {mongoConnection}
              </p>
            ) : null}

            <div className="admin-session-popover__section">
              <p className="admin-session-popover__section-title" id={`${popoverId}-appearance`}>
                Appearance
              </p>
              <p className="admin-session-popover__hint">
                Hub stays dark; this sets your shell for xChat, portfolio, and other product pages.
              </p>
              <XfThemePreferenceMenu aria-labelledby={`${popoverId}-appearance`} />
            </div>

            <button
              className="admin-session-popover-logout"
              disabled={isLoggingOut}
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                void handleLogout();
              }}
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
            {status ? <p className="status-text status-error admin-session-popover__status">{status}</p> : null}
          </div>
        ) : null}
      </div>
      <p className="status-text">
        {displayName ?? username}
        {" | "}
        {email}
      </p>
      {status && !isMenuOpen ? <p className="status-text status-error">{status}</p> : null}
    </div>
  );
}
