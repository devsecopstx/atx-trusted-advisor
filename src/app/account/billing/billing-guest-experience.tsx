"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";

import type { BillingPlanCardPayload } from "@/app/account/billing/billing-plan-cards-client";
import { BillingPlanCardsClient } from "@/app/account/billing/billing-plan-cards-client";
import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";
import {
    ACCESS_REQUEST_PLAN_OPTIONS,
    accessRequestPlanFromBillingPlanId,
    accessRequestPlanLabel,
    type AccessRequestPlanValue
} from "@/lib/access-request-plans";
const FORM_ANCHOR_ID = "billing-register-form";

export type BillingGuestExperienceProps = {
  cards: BillingPlanCardPayload[];
  initialPlan: AccessRequestPlanValue;
  scrollToFormOnMount: boolean;
  googleLoginHref: string | null;
  xOAuthLoginHref: string;
  emailPasswordLoginHref: string;
};

export function BillingGuestExperience({
  cards,
  initialPlan,
  scrollToFormOnMount,
  googleLoginHref,
  xOAuthLoginHref,
  emailPasswordLoginHref
}: BillingGuestExperienceProps) {
  const reduceMotion = useReducedMotion();
  const formRef = useRef<HTMLElement | null>(null);
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const planLegendId = useId();

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registerPlan, setRegisterPlan] = useState<AccessRequestPlanValue>(initialPlan);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [planAnnouncement, setPlanAnnouncement] = useState("");

  useEffect(() => {
    setRegisterPlan(initialPlan);
    setPlanAnnouncement(`${accessRequestPlanLabel(initialPlan)} plan selected`);
  }, [initialPlan]);

  useEffect(() => {
    if (!scrollToFormOnMount) {
      return;
    }
    const t = window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [scrollToFormOnMount]);

  function applyPlanFromBillingId(planId: BillingPlanCardPayload["planId"]) {
    const next = accessRequestPlanFromBillingPlanId(planId);
    setRegisterPlan(next);
    setPlanAnnouncement(`${accessRequestPlanLabel(next)} plan selected`);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registerLoading) {
      return;
    }
    const name = registerName.trim();
    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    if (!name || !email) {
      setRegisterError("Username and email are required.");
      setRegisterSuccess(null);
      return;
    }
    if (!/^[a-zA-Z0-9]{2,120}$/.test(name)) {
      setRegisterError("Username must be 2–120 characters; letters and numbers only.");
      setRegisterSuccess(null);
      return;
    }
    if (password.length < 12) {
      setRegisterError("Password must be at least 12 characters.");
      setRegisterSuccess(null);
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    const submittedPlan = registerPlan;
    const submittedPlanLabel = accessRequestPlanLabel(submittedPlan);
    try {
      const response = await fetch("/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          requestedPlan: submittedPlan,
          password
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          existing?: boolean;
          status?: string;
        };
      };
      if (!response.ok) {
        if (response.status === 409) {
          setRegisterError(
            payload.error ??
              "A pending access request already exists for this account, or this email already has a password."
          );
          return;
        }
        setRegisterError(payload.error ?? `Could not submit request (${response.status}).`);
        return;
      }

      const loginTry = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          next: "/xchat"
        })
      });
      const loginJson = (await loginTry.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; error?: string };

      if (loginTry.ok && loginJson.ok && loginJson.redirect) {
        window.location.href = loginJson.redirect;
        return;
      }

      setRegisterSuccess(
        `Account ready for ${submittedPlanLabel}. Sign in to start your guest trial — billing can be completed anytime.`
      );
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterPlan(initialPlan);
    } catch {
      setRegisterError("Network error. Retry in a moment.");
    } finally {
      setRegisterLoading(false);
    }
  }

  const oauthProviderStack = (
    <>
      {googleLoginHref ? (
        <a className="cta cta-oauth-google login-google-btn billing-guest-oauth__btn" href={googleLoginHref}>
          <GoogleGIcon size={20} />
          Google
        </a>
      ) : (
        <button
          className="cta cta-secondary billing-guest-oauth__btn billing-guest-oauth__btn--disabled"
          disabled
          type="button"
        >
          <GoogleGIcon size={20} />
          Google unavailable
        </button>
      )}
      <a className="cta cta-secondary login-oauth-x billing-guest-oauth__btn" href={xOAuthLoginHref}>
        <XLogoIcon size={20} />
        X
      </a>
    </>
  );

  const inputClass =
    "w-full rounded-[var(--xf-radius-sm)] border border-[color-mix(in_srgb,var(--xf-text-400)_28%,transparent)] bg-[var(--xf-surface-700)] px-3 py-2.5 text-sm text-[var(--xf-text-100)] outline-none transition-[box-shadow] placeholder:text-[var(--xf-text-400)] focus:border-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)]";

  return (
    <div className="billing-guest-experience">
      <div className="billing-guest-experience__grid lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-12">
        <motion.section
          ref={formRef}
          animate={{ opacity: 1, y: 0 }}
          className="billing-guest-form-section xf-widget surface-card section-card mx-auto w-full max-w-md lg:sticky lg:top-24 lg:mx-0 lg:max-w-none"
          id={FORM_ANCHOR_ID}
          initial={{ opacity: reduceMotion ? 1 : 0.86, y: reduceMotion ? 0 : 10 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="billing-guest-form-section__inner space-y-5 p-5 sm:p-6">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--xf-text-400)]">
                Create your ATX account
              </p>
              <h2 className="text-xl font-bold tracking-tight text-[var(--xf-text-100)]">Sign up</h2>
            </header>

            <div aria-live="polite" className="sr-only">
              {planAnnouncement}
            </div>

            {!registerSuccess ? (
              <form className="flex flex-col gap-4" onSubmit={handleRegister}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--xf-text-200)]" htmlFor={usernameId}>
                    Username
                  </label>
                  <span className="text-xs text-[var(--xf-text-400)]">Letters and numbers only</span>
                  <input
                    autoComplete="username"
                    className={inputClass}
                    disabled={registerLoading}
                    id={usernameId}
                    maxLength={120}
                    name="username"
                    onChange={(event) => setRegisterName(event.target.value)}
                    placeholder="Username"
                    required
                    type="text"
                    value={registerName}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--xf-text-200)]" htmlFor={emailId}>
                    Email
                  </label>
                  <input
                    autoComplete="email"
                    className={inputClass}
                    disabled={registerLoading}
                    id={emailId}
                    maxLength={320}
                    name="email"
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                    type="email"
                    value={registerEmail}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="text-sm font-medium text-[var(--xf-text-200)]" htmlFor={passwordId}>
                      Password
                    </label>
                    <button
                      aria-pressed={showPassword}
                      className="shrink-0 text-xs font-medium text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 hover:opacity-90"
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <span className="text-xs text-[var(--xf-text-400)]">At least 12 characters</span>
                  <input
                    autoComplete="new-password"
                    className={inputClass}
                    disabled={registerLoading}
                    id={passwordId}
                    maxLength={128}
                    name="password"
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder="••••••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                    value={registerPassword}
                  />
                </div>

                <fieldset className="min-w-0 space-y-2 border-0 p-0">
                  <legend className="sr-only" id={planLegendId}>
                    Plan
                  </legend>
                  <span className="text-sm font-medium text-[var(--xf-text-200)]">Plan</span>
                  <div
                    aria-labelledby={planLegendId}
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                  >
                    {ACCESS_REQUEST_PLAN_OPTIONS.map((option) => {
                      const selected = registerPlan === option.value;
                      return (
                        <button
                          key={option.value}
                          aria-checked={selected}
                          className={`billing-plan-pill rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)] ${
                            selected
                              ? "border-[color-mix(in_srgb,var(--xf-gain-green)_65%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_14%,var(--xf-surface-700))] text-[var(--xf-text-100)]"
                              : "border-[color-mix(in_srgb,var(--xf-text-400)_35%,transparent)] bg-[var(--xf-surface-800)] text-[var(--xf-text-300)] hover:border-[color-mix(in_srgb,var(--xf-text-300)_45%,transparent)]"
                          }`}
                          role="radio"
                          type="button"
                          onClick={() => {
                            setRegisterPlan(option.value);
                            setPlanAnnouncement(`${option.label} plan selected`);
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <button
                  className="billing-signup-primary"
                  disabled={registerLoading}
                  type="submit"
                >
                  {registerLoading ? "Creating account…" : "Sign up"}
                </button>

                {registerError ? (
                  <p className="text-sm text-[var(--xf-danger-400)]" role="alert">
                    {registerError}
                  </p>
                ) : null}

                <p className="text-center text-xs font-medium uppercase tracking-[0.12em] text-[var(--xf-text-400)]">
                  Or continue with
                </p>
                <div className="billing-guest-oauth-row">{oauthProviderStack}</div>

                <p className="text-center text-xs text-[var(--xf-text-400)]">
                  <a
                    className="font-semibold text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
                    href={emailPasswordLoginHref}
                  >
                    Already have an account? Sign in
                  </a>
                </p>

                <p className="text-center text-[10px] leading-snug text-[var(--xf-text-400)]">
                  NOT FINANCIAL ADVICE. Guest mode is read-only.
                </p>
              </form>
            ) : (
              <div className="space-y-4" role="status">
                <p className="text-sm text-[var(--xf-text-200)]">{registerSuccess}</p>
                <p className="text-xs text-[var(--xf-text-400)]">
                  Use the same email with <strong className="text-[var(--xf-text-200)]">X</strong>,{" "}
                  <strong className="text-[var(--xf-text-200)]">Google</strong>, or{" "}
                  <strong className="text-[var(--xf-text-200)]">email + password</strong> once an admin approves you.
                </p>
                <div className="billing-guest-oauth-row">{oauthProviderStack}</div>
                <p className="text-center text-xs text-[var(--xf-text-400)]">
                  <a
                    className="font-semibold text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
                    href={emailPasswordLoginHref}
                  >
                    Sign in
                  </a>
                </p>
              </div>
            )}
          </div>
        </motion.section>

        <div className="billing-guest-plans mt-10 min-w-0 lg:mt-0">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--xf-text-400)]">
            Compare plans
          </h3>
          <BillingPlanCardsClient
            approved={false}
            cards={cards}
            checkoutReady={false}
            guestFormAnchorId={FORM_ANCHOR_ID}
            guestOnSelectPlan={applyPlanFromBillingId}
          />
        </div>
      </div>
    </div>
  );
}
