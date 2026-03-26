"use client";

import { useForm, ValidationError } from "@formspree/react";
import Link from "next/link";

import { AtxFinanceLogo, AtxFinanceMark, LightningBolt } from "@/app/ui/atxfinance-logo";
import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";

export const DEFAULT_POST_LOGIN = "/xchat";

function hasValidFormspreeEndpoint(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && /^https?:\/\//i.test(trimmed);
}

type DemoContactFormProps = {
  endpoint: string;
};

function DemoContactForm({ endpoint }: DemoContactFormProps) {
  const [state, handleSubmit] = useForm(endpoint);
  if (state.succeeded) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-5 py-4 text-emerald-100/95">
        <p className="font-semibold text-emerald-200">Thanks — we got your note.</p>
        <p className="mt-1 text-sm text-emerald-100/80">
          We will reply from Formspree to your email with demo or onboarding next steps.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
      <input type="hidden" name="_subject" value="aTx Trusted Advisor — demo / onboarding request" />
      <div>
        <label htmlFor="home-contact-email" className="mb-1 block text-xs font-medium text-gray-400">
          Work email
        </label>
        <input
          id="home-contact-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          className="w-full rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        />
        <ValidationError prefix="Email" field="email" errors={state.errors} className="mt-1 text-sm text-red-400" />
      </div>
      <div>
        <label htmlFor="home-contact-message" className="mb-1 block text-xs font-medium text-gray-400">
          Demo, onboarding, or questions
        </label>
        <textarea
          id="home-contact-message"
          name="message"
          rows={4}
          placeholder="e.g. Request a walkthrough, pilot scope, or how approval works"
          className="min-h-[100px] w-full resize-y rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        />
        <ValidationError prefix="Message" field="message" errors={state.errors} className="mt-1 text-sm text-red-400" />
      </div>
      <button
        type="submit"
        disabled={state.submitting}
        className="mt-1 w-full rounded-full border-2 border-emerald-500 bg-transparent py-3.5 text-base font-bold text-emerald-400 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
      >
        {state.submitting ? "Sending…" : "Request demo & onboarding details"}
      </button>
    </form>
  );
}

function FormspreeMissingNotice() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-5 py-4 text-left text-sm text-amber-100/90">
      <p className="font-semibold text-amber-200">Contact form not configured</p>
      <p className="mt-1 leading-relaxed text-amber-100/80">
        Add{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-emerald-200/90">
          NEXT_PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/your-id
        </code>{" "}
        to your env and restart the app. Create a form at{" "}
        <a href="https://formspree.io" className="underline underline-offset-2 hover:text-white" target="_blank" rel="noreferrer">
          formspree.io
        </a>
        .
      </p>
    </div>
  );
}

type HomeLandingProps = {
  formspreeEndpoint?: string;
  /** When set, shows Sign in with Google linking to `/api/auth/google/login`. */
  googleLoginHref?: string | null;
};

export function HomeLanding({
  formspreeEndpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT ?? "",
  googleLoginHref = null
}: HomeLandingProps) {
  const raw = (formspreeEndpoint || "").trim();
  const hasFormspree = hasValidFormspreeEndpoint(raw);

  const loginHref = `/login?next=${encodeURIComponent(DEFAULT_POST_LOGIN)}`;
  const xOAuthHref = `/api/auth/x/login?next=${encodeURIComponent(DEFAULT_POST_LOGIN)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-slate-950 to-black text-gray-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% -15%, rgba(251, 191, 36, 0.12), transparent 55%), radial-gradient(ellipse 80% 50% at 85% 20%, rgba(234, 179, 8, 0.06), transparent 50%)"
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16 sm:py-24">
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="flex justify-center">
            <AtxFinanceLogo size="lg" showSubtitle={false} />
          </div>
          <h1 className="flex max-w-2xl flex-col items-center gap-3 text-balance">
            <span className="flex items-center justify-center gap-0.5 sm:gap-1">
              <span className="inline-flex items-center gap-0.5 sm:hidden">
                <AtxFinanceMark size={40} />
                <LightningBolt size={26} />
              </span>
              <span className="hidden items-center gap-0.5 sm:inline-flex">
                <AtxFinanceMark size={48} />
                <LightningBolt size={30} />
              </span>
            </span>
            <span className="text-base font-semibold tracking-tight text-gray-300 sm:text-lg">
              Finance — Powered by xAI
            </span>
            <span className="text-lg font-medium tracking-tight text-gray-200 sm:text-xl md:text-2xl">
              No atoms moved.
            </span>
            <span className="text-lg font-medium tracking-tight text-gray-200 sm:text-xl md:text-2xl">
              Just{" "}
              <span className="font-bold" style={{ color: "var(--xf-gain-green)" }}>
                Gains
              </span>
              , <span className="font-bold italic text-gray-100">growth</span> earned.
            </span>
          </h1>
          <p className="max-w-2xl text-lg text-gray-300 sm:text-xl">
            Explore as a guest, sign in with Google or X for an approved session, or reach us for a demo and onboarding.
          </p>
        </header>

        <section
          aria-labelledby="home-register-heading"
          className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"
        >
          <h2 id="home-register-heading" className="text-lg font-bold text-white sm:text-xl">
            Register — explore first
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Preview xChat in guest mode, then request access when you are ready for an approved workspace.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link
              href="/xchat"
              className="inline-flex items-center justify-center rounded-full border-2 border-emerald-500/70 bg-emerald-500/10 px-8 py-4 text-center text-lg font-bold text-emerald-100 shadow-lg shadow-emerald-900/30 transition hover:border-emerald-400 hover:bg-emerald-500/20"
            >
              Explore xChat &amp; request access
            </Link>
            <Link
              href="/login?next=%2Fxchat"
              className="inline-flex items-center justify-center rounded-full border border-gray-600 px-8 py-4 text-center text-base font-semibold text-gray-200 transition hover:border-emerald-500/50 hover:text-white"
            >
              Continue to sign-in
            </Link>
          </div>
        </section>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
          {googleLoginHref ? (
            <a
              href={googleLoginHref}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-center text-lg font-bold text-gray-900 shadow-lg shadow-black/20 transition hover:bg-gray-100"
            >
              <GoogleGIcon size={22} className="shrink-0" />
              Sign in with Google
            </a>
          ) : null}
          <Link
            href={googleLoginHref ? xOAuthHref : loginHref}
            className={`inline-flex items-center justify-center gap-3 rounded-full px-8 py-4 text-center text-lg font-bold shadow-lg transition ${
              googleLoginHref
                ? "border-2 border-emerald-500/80 bg-transparent text-emerald-100 hover:border-emerald-400 hover:bg-emerald-500/10"
                : "bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-400"
            }`}
          >
            <XLogoIcon size={22} className="shrink-0 text-white" />
            Sign in with X
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500">
          OAuth or cookie issues?{" "}
          <a className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300" href={xOAuthHref}>
            Start OAuth from this host
          </a>{" "}
          (same origin as callback).
        </p>

        <section id="contact" className="scroll-mt-24 rounded-2xl border border-emerald-500/15 bg-gray-900/40 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Request a demo or onboarding details</h2>
          <p className="mt-2 text-sm text-gray-400">
            We use Formspree for inbound requests — include context (firm type, custodian, timeline) and we will follow
            up by email.
          </p>
          <div className="mt-6">{hasFormspree ? <DemoContactForm endpoint={raw} /> : <FormspreeMissingNotice />}</div>
        </section>

        <footer className="text-center text-xs text-gray-500">
          Not financial advice. Options involve risk of loss. For qualified operators evaluating software-assisted
          workflows.
        </footer>
      </div>
    </main>
  );
}
