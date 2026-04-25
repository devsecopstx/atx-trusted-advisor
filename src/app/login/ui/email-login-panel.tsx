"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

export function EmailLoginPanel({ nextPath }: { nextPath: string }) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password, next: nextPath })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };
      if (!res.ok) {
        setError(
          data.error === "invalid_credentials"
            ? "Invalid email or password."
            : data.error === "not_authorized"
              ? "Your account is not approved for sign-in yet."
              : data.error === "email_unverified"
                ? "Email is not verified yet. Check your inbox for a verification link."
              : data.error === "suspended"
                ? "This account is suspended."
                : data.error === "no_tenant"
                  ? "Account setup is incomplete. Contact support."
                  : data.error ?? "Sign-in failed."
        );
        return;
      }
      window.location.href = data.redirect ?? "/xchat";
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-email-block w-full space-y-4">
      <h2 className="text-sm font-semibold text-[var(--xf-text-200)]">Email and password</h2>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm" htmlFor={emailId}>
          <span className="text-[var(--xf-text-200)]">Email</span>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-[var(--xf-text-200)]" htmlFor={passwordId}>
              Password
            </label>
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="status-text status-error text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="cta cta-primary w-full justify-center py-3.5 text-base disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="flex flex-col gap-3 text-center text-sm sm:text-left">
        <Link
          href="/login/forgot-password"
          className="font-medium text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
        >
          Forgot password?
        </Link>
        <p className="text-[var(--xf-text-muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/xchat"
            className="font-semibold text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
