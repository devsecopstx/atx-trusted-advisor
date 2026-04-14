"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/email/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };
      if (!res.ok) {
        setError(
          data.error === "invalid_or_expired"
            ? "This link is invalid or expired. Request a new reset from the sign-in page."
            : data.error ?? "Could not reset password."
        );
        return;
      }
      window.location.href = data.redirect ?? "/xchat";
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <p className="status-text status-error">
        Missing token.{" "}
        <Link href="/login/forgot-password" className="underline">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--xf-text-200)]">New password (min 10 characters)</span>
        <input
          type="password"
          autoComplete="new-password"
          className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          required
          minLength={10}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--xf-text-200)]">Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2"
          value={confirm}
          onChange={(ev) => setConfirm(ev.target.value)}
          required
          minLength={10}
        />
      </label>
      {error ? (
        <p className="status-text status-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="cta cta-primary self-start px-4 py-2 rounded-lg">
        {pending ? "Saving…" : "Update password & sign in"}
      </button>
    </form>
  );
}
