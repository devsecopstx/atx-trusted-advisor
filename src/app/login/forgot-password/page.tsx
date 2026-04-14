"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/email/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Request failed.");
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)] p-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold mb-2">Forgot password</h1>
        <p className="text-sm text-[var(--xf-text-muted)] mb-6">
          If an account exists with this email and a password is configured, we will send a reset link.
        </p>
        {done ? (
          <p className="status-text">Check your inbox for reset instructions.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--xf-text-200)]">Email</span>
              <input
                type="email"
                autoComplete="email"
                className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="status-text status-error text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={pending} className="cta cta-primary self-start px-4 py-2 rounded-lg">
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-8 text-sm">
          <Link href="/login" className="text-[var(--xf-gain-green)] underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
