"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

export function SetPasswordForm() {
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
      setError("Missing invite token. Open the link from your approval email.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/email/complete-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };
      if (!res.ok) {
        setError(
          data.error === "invalid_or_expired"
            ? "This link is invalid or expired. Ask an admin to resend approval."
            : data.error === "already_has_password"
              ? "Password already set. Sign in or use forgot password."
              : data.error === "not_authorized"
                ? "Your account is not approved yet."
                : data.error ?? "Could not set password."
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
        Missing token. Use the link from your approval email, or{" "}
        <Link href="/login" className="underline">
          sign in
        </Link>{" "}
        if you already set a password.
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
        {pending ? "Saving…" : "Set password & sign in"}
      </button>
    </form>
  );
}
