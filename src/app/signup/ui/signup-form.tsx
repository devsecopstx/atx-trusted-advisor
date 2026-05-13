"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

import {
    ACCESS_REQUEST_PLAN_OPTIONS,
    accessRequestPlanLabel,
    type AccessRequestPlanValue
} from "@/lib/access-request-plans";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE } from "@/lib/country-options";

const USERNAME_PATTERN = /^[a-zA-Z0-9]{2,120}$/;
const MIN_PASSWORD_LENGTH = 12;

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

export function SignupForm() {
  const countryId = useId();
  const emailId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const planId = useId();

  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState<AccessRequestPlanValue>("basic");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const submitting = state.kind === "submitting";
  const succeeded = state.kind === "success";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const trimmedName = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(trimmedName)) {
      setState({ kind: "error", message: "Username must be 2–120 characters; letters and numbers only." });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setState({ kind: "error", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: normalizedEmail,
          password,
          country,
          requestedPlan: plan
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { existing?: boolean; status?: string };
      };
      if (!res.ok) {
        if (res.status === 409) {
          setState({
            kind: "error",
            message:
              data.error ??
              "A pending access request already exists for this email. Sign in instead or use forgot password."
          });
          return;
        }
        setState({
          kind: "error",
          message: data.error ?? `Could not submit signup (${res.status}).`
        });
        return;
      }
      setState({
        kind: "success",
        message: data.data?.existing
          ? `You already have a pending ${accessRequestPlanLabel(plan)} request. We will review it soon.`
          : `Request submitted for ${accessRequestPlanLabel(plan)}. An admin will review your access.`
      });
    } catch {
      setState({ kind: "error", message: "Network error. Retry in a moment." });
    }
  }

  return (
    <div className="login-email-block w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-[var(--xf-text-200)]">Welcome to aTx Trusted Advisor</h2>
        <p className="text-2xl font-bold tracking-tight text-[var(--xf-text-100)]">Let&apos;s get started</p>
        <p className="text-xs leading-relaxed text-[var(--xf-text-muted)]">
          Pick a country, email, username, and password. After an admin approves your access, sign in with your
          username or email.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm" htmlFor={countryId}>
          <span className="text-[var(--xf-text-200)]">Country of Residence</span>
          <select
            id={countryId}
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            disabled={submitting || succeeded}
            value={country}
            onChange={(ev) => setCountry(ev.target.value)}
            required
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm" htmlFor={emailId}>
          <span className="text-[var(--xf-text-200)]">Email Address</span>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="Email Address"
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            disabled={submitting || succeeded}
            maxLength={320}
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <label className="text-[var(--xf-text-200)]" htmlFor={usernameId}>
            Username
          </label>
          <span className="text-xs text-[var(--xf-text-muted)]">Only use letters and numbers</span>
          <input
            id={usernameId}
            type="text"
            autoComplete="username"
            placeholder="Username"
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            disabled={submitting || succeeded}
            maxLength={120}
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            required
          />
        </div>

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
              disabled={submitting || succeeded}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <span className="text-xs text-[var(--xf-text-muted)]">{MIN_PASSWORD_LENGTH}+ characters</span>
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Password"
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            disabled={submitting || succeeded}
            maxLength={128}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </div>

        <label className="flex flex-col gap-1 text-sm" htmlFor={planId}>
          <span className="text-[var(--xf-text-200)]">Plan</span>
          <select
            id={planId}
            className="crud-input rounded-lg border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] px-3 py-2.5 text-[var(--xf-text-100)]"
            disabled={submitting || succeeded}
            value={plan}
            onChange={(ev) => setPlan(ev.target.value as AccessRequestPlanValue)}
          >
            {ACCESS_REQUEST_PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {state.kind === "error" ? (
          <p className="status-text status-error text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.kind === "success" ? (
          <p className="status-text text-sm" role="status">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || succeeded}
          className="cta cta-primary w-full justify-center py-3.5 text-base disabled:opacity-60"
        >
          {submitting ? "Signing up…" : succeeded ? "Submitted" : "Sign up"}
        </button>
      </form>

      <p className="text-center text-xs leading-relaxed text-[var(--xf-text-muted)] sm:text-left">
        By continuing, you agree to ATX Advisor&apos;s{" "}
        <Link
          href="/legal/terms"
          className="font-medium text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/legal/privacy"
          className="font-medium text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <p className="text-center text-sm text-[var(--xf-text-muted)] sm:text-left">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
        >
          Log in here
        </Link>
        .
      </p>
    </div>
  );
}
