"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { AtxFinanceMark, LightningBolt } from "@/app/ui/atxfinance-logo";
import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";

import { EmailLoginPanel } from "./email-login-panel";

const lift = { y: -2 };

type LoginAuthSurfaceClientProps = {
  nextPath: string;
  googleLoginHref: string | null;
  xOAuthLoginHref: string;
  errorMessage: string | null;
};

export function LoginAuthSurfaceClient({
  nextPath,
  googleLoginHref,
  xOAuthLoginHref,
  errorMessage
}: LoginAuthSurfaceClientProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [xBusy, setXBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-10 sm:px-8 lg:mx-0 lg:max-w-none lg:px-10 lg:py-14 xl:px-14">
      <header className="space-y-3 text-center lg:text-left">
        <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
          <AtxFinanceMark size={32} />
          <LightningBolt size={26} />
          <span className="text-lg font-bold tracking-tight text-[var(--xf-text-100)]">Finance Advisor</span>
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-[var(--xf-text-100)] sm:text-[1.65rem]">
          Sign in to your xAI-powered portfolio command center
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-[var(--xf-text-muted)]">
          Institutional-grade options intelligence for high-net-worth portfolios.
        </p>
      </header>

      {errorMessage ? (
        <p className="status-text status-error text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <motion.a
          href={xOAuthLoginHref}
          aria-busy={xBusy}
          aria-label="Continue with X — primary sign-in"
          onClick={() => setXBusy(true)}
          whileHover={lift}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-text-100)] px-5 py-4 text-center text-base font-semibold text-[var(--xf-bg-900)] shadow-[0_12px_40px_color-mix(in_srgb,var(--xf-bg-900)_55%,transparent)] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xf-bg-900)] hover:opacity-[0.96] disabled:opacity-60"
        >
          {xBusy ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="size-4 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--xf-bg-900)_35%,transparent)] border-t-[var(--xf-bg-900)]"
                aria-hidden
              />
              Redirecting…
            </span>
          ) : (
            <>
              <XLogoIcon size={22} />
              Continue with X
            </>
          )}
        </motion.a>

        {googleLoginHref ? (
          <motion.a
            href={googleLoginHref}
            aria-busy={googleBusy}
            aria-label="Continue with Google"
            onClick={() => setGoogleBusy(true)}
            whileHover={lift}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="cta cta-secondary login-oauth-secondary-btn login-google-btn flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--xf-xchat-rail-border)] bg-transparent px-4 py-3 text-sm font-medium text-[var(--xf-text-100)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xf-bg-900)]"
          >
            {googleBusy ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-3.5 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--xf-text-muted)_55%,transparent)] border-t-[var(--xf-gain-green)]"
                  aria-hidden
                />
                Redirecting…
              </span>
            ) : (
              <>
                <GoogleGIcon size={18} />
                Continue with Google
              </>
            )}
          </motion.a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label="Google sign-in is not configured on this server"
            className="cta cta-secondary login-oauth-section__google-disabled w-full cursor-not-allowed justify-center gap-2 rounded-xl py-3 text-sm opacity-55"
          >
            <GoogleGIcon size={18} />
            Google unavailable
          </button>
        )}

        <motion.button
          type="button"
          aria-expanded={emailOpen}
          aria-controls="login-email-password-panel"
          onClick={() => setEmailOpen((v) => !v)}
          whileHover={lift}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="cta cta-secondary flex w-full items-center justify-center rounded-xl border border-[var(--xf-xchat-rail-border)] bg-transparent px-4 py-3 text-sm font-medium text-[var(--xf-text-100)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xf-bg-900)]"
        >
          {emailOpen ? "Hide email sign-in" : "Sign in with email & password"}
        </motion.button>
      </div>

      {emailOpen ? (
        <div
          id="login-email-password-panel"
          className="rounded-xl border border-[color-mix(in_srgb,var(--xf-xchat-rail-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--xf-xchat-rail-bg)_65%,var(--xf-bg-900))] p-4 sm:p-5"
        >
          <EmailLoginPanel compact nextPath={nextPath} showSignupLink={false} />
        </div>
      ) : null}

      <p className="text-center text-sm text-[var(--xf-text-muted)] lg:text-left">
        New to the workspace?{" "}
        <Link
          href={signupHref}
          className="font-semibold text-[var(--xf-gain-green)] underline decoration-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] underline-offset-2 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xf-bg-900)]"
        >
          Sign up here
        </Link>
      </p>
    </div>
  );
}
