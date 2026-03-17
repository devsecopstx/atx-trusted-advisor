"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
      window.location.href = "/login";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Logout failed");
    } finally {
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!popoverRef.current) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !popoverRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileOpen]);

  return (
    <div className="badge-wrap admin-session-panel">
      <div className="admin-session-identity" ref={popoverRef}>
        {avatarUrl ? (
          <Image
            alt={`${displayName ?? username} profile`}
            className="admin-session-avatar"
            height={40}
            src={avatarUrl}
            unoptimized
            width={40}
          />
        ) : (
          <span className="admin-session-avatar admin-session-avatar-fallback">
            {(displayName ?? username).slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="status-badge status-ready">@{username}</span>
        <button
          aria-controls={popoverId}
          aria-expanded={isProfileOpen}
          aria-label="Profile details"
          className="tiny-button"
          onClick={() => setIsProfileOpen((current) => !current)}
          type="button"
        >
          i
        </button>
        {isProfileOpen ? (
          <div className="admin-session-popover" id={popoverId} role="dialog">
            <p>
              <strong>Name:</strong> {displayName ?? username}
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
            <button
              className="admin-session-popover-done"
              onClick={() => setIsProfileOpen(false)}
              type="button"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
      <p className="status-text">
        {displayName ?? username}
        {" | "}
        {email}
      </p>
      <button
        className="cta cta-secondary"
        disabled={isLoggingOut}
        onClick={() => void handleLogout()}
        type="button"
      >
        {isLoggingOut ? "Logging out..." : "Logout"}
      </button>
      {status ? <p className="status-text status-error">{status}</p> : null}
    </div>
  );
}
