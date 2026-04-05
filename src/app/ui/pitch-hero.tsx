"use client";

import { useForm, ValidationError } from "@formspree/react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/** Headline + tagline: fade + slight scale */
const heroLeadVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const subheadVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/** Three value bullets — staggerChildren + delayChildren */
const bulletContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.18,
      delayChildren: 0.42,
    },
  },
};

const bulletItemVariants = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/** CTAs: initial fade-up, then stagger primary vs waitlist */
const ctaRowVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.14,
      delayChildren: 0.55,
    },
  },
};

const ctaItemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const ctaHoverTap = {
  rest: { scale: 1 },
  hover: { scale: 1.03, transition: { duration: 0.2 } },
  tap: { scale: 0.98 },
};

/** Where to send users after sign-in when using the default direct X OAuth link. */
export const DEFAULT_PITCH_LOGIN_RETURN_PATH = "/xchat";

export function buildPitchLoginHref(returnPath: string): string {
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  return `/api/auth/x/login?next=${encodeURIComponent(path)}`;
}

/**
 * Default primary CTA: direct X OAuth login with `next` return path.
 * Override with `NEXT_PUBLIC_SIGNIN_URL` or `signInHref`.
 */
export const DEFAULT_PITCH_LOGIN_HREF = buildPitchLoginHref(DEFAULT_PITCH_LOGIN_RETURN_PATH);

export type HeroProps = {
  /** Formspree form URL, e.g. `https://formspree.io/f/xxxx`. Prefer `NEXT_PUBLIC_FORMSPREE_ENDPOINT` in `.env.local`. */
  formspreeEndpoint?: string;
  /** Product name shown in the H1 (e.g. xoptions). */
  title?: string;
  /**
   * Primary auth CTA. Defaults to `NEXT_PUBLIC_SIGNIN_URL`, else {@link buildPitchLoginHref} with
   * {@link loginReturnPath} (typically `/api/auth/x/login?next=/xchat`).
   */
  signInHref?: string;
  /** `next` query value for direct X OAuth login. Default: {@link DEFAULT_PITCH_LOGIN_RETURN_PATH}. */
  loginReturnPath?: string;
};

function WaitlistForm({
  endpoint,
  productLabel,
}: {
  endpoint: string;
  productLabel: string;
}) {
  const [state, handleSubmit] = useForm(endpoint);
  const showSuccess = state.succeeded;

  if (showSuccess) {
    return (
      <motion.div
        variants={ctaItemVariants}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto sm:mx-0 text-emerald-400 font-semibold text-lg sm:text-xl self-center text-center sm:text-left"
      >
        Thanks — you are on the list. We will follow up shortly.
      </motion.div>
    );
  }

  return (
    <motion.form
      variants={ctaItemVariants}
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto sm:mx-0 flex flex-col text-left"
    >
      <p className="text-sm text-gray-400 mb-3">
        <span className="text-gray-300 font-medium">Join waitlist</span> — we will reply from Formspree to your email.
      </p>
      <input type="hidden" name="_subject" value={`${productLabel} waitlist`} />
      <input
        type="email"
        name="email"
        autoComplete="email"
        placeholder="Work email"
        required
        className="w-full px-6 py-4 mb-3 bg-gray-900/80 border border-gray-700 rounded-full text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
      />
      <ValidationError prefix="Email" field="email" errors={state.errors} className="text-red-400 text-sm mb-2" />

      <textarea
        name="message"
        placeholder="Optional: HNWI / trusted-family, AUM band, custodian"
        rows={3}
        className="w-full px-6 py-4 mb-4 bg-gray-900/80 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 resize-y min-h-[88px]"
      />
      <ValidationError prefix="Message" field="message" errors={state.errors} className="text-red-400 text-sm mb-2" />

      <motion.div initial="rest" whileHover="hover" whileTap="tap" variants={ctaHoverTap}>
        <button
          type="submit"
          disabled={state.submitting}
          className="w-full bg-transparent border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500/15 font-bold py-4 px-8 rounded-full text-lg sm:text-xl transition-colors disabled:opacity-50"
        >
          {state.submitting ? "Submitting…" : "Join waitlist"}
        </button>
      </motion.div>
    </motion.form>
  );
}

function FormspreeMissingNotice({ productLabel }: { productLabel: string }) {
  return (
    <motion.div
      variants={ctaItemVariants}
      className="w-full max-w-md mx-auto sm:mx-0 rounded-xl border border-amber-500/30 bg-amber-950/20 px-5 py-4 text-left text-sm text-amber-100/90"
    >
      <p className="font-semibold text-amber-200 mb-1">Formspree not configured</p>
      <p className="text-amber-100/80 leading-relaxed">
        Add{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-emerald-200/90">
          NEXT_PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/your-id
        </code>{" "}
        to <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">.env.local</code> (create a form at{" "}
        <a href="https://formspree.io" className="underline underline-offset-2 hover:text-white" target="_blank" rel="noreferrer">
          formspree.io
        </a>
        ). Then restart <code className="text-xs">next dev</code>. Waitlist: <strong>{productLabel}</strong>.
      </p>
    </motion.div>
  );
}

export default function Hero({
  formspreeEndpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "",
  title = "xoptions",
  signInHref: signInHrefProp,
  loginReturnPath = DEFAULT_PITCH_LOGIN_RETURN_PATH,
}: HeroProps) {
  const reduceMotion = useReducedMotion();
  const signInHref =
    signInHrefProp?.trim() ||
    process.env.NEXT_PUBLIC_SIGNIN_URL?.trim() ||
    buildPitchLoginHref(loginReturnPath);

  const rawFormspree = (formspreeEndpoint || "").trim();
  const hasFormspree = rawFormspree.length > 0 && /^https?:\/\//i.test(rawFormspree);

  return (
    <section className="relative py-16 sm:py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-slate-950 to-black" />

      <div
        className="absolute inset-0 pointer-events-none opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% -15%, rgba(251, 191, 36, 0.14), transparent 55%), radial-gradient(ellipse 80% 50% at 85% 20%, rgba(234, 179, 8, 0.08), transparent 50%)",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 100%, rgba(52, 211, 153, 0.12), transparent 55%)",
        }}
      />

      <motion.div
        className="absolute right-[8%] top-[12%] h-24 w-24 md:h-32 md:w-32 pointer-events-none opacity-[0.18] md:opacity-[0.22]"
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : {
                y: [0, -6, 0],
                rotate: [0, 1.5, -1.5, 0]
              }
        }
        transition={
          reduceMotion
            ? undefined
            : { duration: 10, repeat: Infinity, ease: "easeInOut" as const }
        }
      >
        <svg viewBox="0 0 64 64" className="h-full w-full text-amber-300/90 drop-shadow-[0_0_28px_rgba(250,204,21,0.45)]">
          <path fill="currentColor" d="M38 4L14 36h16l-6 24 28-36H36l6-20z" />
        </svg>
      </motion.div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={pageVariants}>
            <motion.div variants={bulletItemVariants} className="mb-8">
              <div className="mb-5 flex justify-center">
                <Image
                  alt="aTx app hero icon"
                  className="app-hero-icon-img h-20 w-20"
                  height={80}
                  src="/branding/xstrategybuilder-topnav-icon-transparent.png"
                  width={80}
                />
              </div>
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-500/90 font-semibold mb-3">
                Options income · Delegated
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white">{title}</h1>
              <p className="mt-2 text-xl md:text-2xl text-emerald-400 font-medium">Powered by xAI</p>
            </motion.div>

            <motion.h2
              variants={heroLeadVariants}
              className="text-3xl sm:text-4xl md:text-6xl font-extrabold leading-tight mb-6 text-white"
            >
              Save time. Delegate execution.
              <br className="hidden sm:block" />
              Keep control of your book.
            </motion.h2>

            <motion.p
              variants={heroLeadVariants}
              className="text-xl sm:text-2xl md:text-3xl font-semibold text-emerald-400 mb-8"
            >
              No Atoms Moved — Just Gains Earned.
            </motion.p>

            <motion.p
              variants={subheadVariants}
              className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              aTx is built for options-focused investors and professionals who want execution-style portfolio tooling,
              xAI-powered advisory chat, and exam prep in one controlled workspace — not a pile of disconnected
              dashboards or generic chatbots.
            </motion.p>

            <motion.div
              variants={bulletContainerVariants}
              initial="hidden"
              animate="visible"
              className="grid sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 text-left"
            >
              <motion.div
                variants={bulletItemVariants}
                className="bg-gray-900/55 backdrop-blur-sm p-6 rounded-xl border border-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
              >
                <h3 className="text-xl font-bold text-emerald-400 mb-3">Time-saving</h3>
                <p className="text-gray-300 text-[15px] leading-relaxed">
                  One to two concise ideas per week — rationale, sizing, risk flags, and order previews. Approve in
                  minutes; no scanning charts or rebuilding the wheel yourself.
                </p>
              </motion.div>

              <motion.div
                variants={bulletItemVariants}
                className="bg-gray-900/55 backdrop-blur-sm p-6 rounded-xl border border-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
              >
                <h3 className="text-xl font-bold text-emerald-500 mb-3">Hassle-free & delegated</h3>
                <p className="text-gray-300 text-[15px] leading-relaxed">
                  Broker-ready previews, conservative defaults, and conflict checks — so you spend time on judgment, not
                  busywork. Built for efficiency, not hype.
                </p>
              </motion.div>

              <motion.div
                variants={bulletItemVariants}
                className="bg-gray-900/55 backdrop-blur-sm p-6 rounded-xl border border-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
              >
                <h3 className="text-xl font-bold text-emerald-400 mb-3">Serious portfolios</h3>
                <p className="text-gray-300 text-[15px] leading-relaxed">
                  Sized for large private wealth and trusted-family standards — exports, audit trails, risk alerts, and
                  overrides when you need them.
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              variants={ctaRowVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col lg:flex-row justify-center gap-8 lg:gap-10 mb-8 items-stretch lg:items-start"
            >
              <motion.div variants={ctaItemVariants} className="flex justify-center lg:justify-end lg:flex-1">
                <motion.div initial="rest" whileHover="hover" whileTap="tap" variants={ctaHoverTap}>
                  <Link
                    href={signInHref}
                    className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-5 px-8 sm:px-10 rounded-full text-lg sm:text-xl shadow-lg shadow-emerald-500/20 border border-emerald-400/30 min-w-[240px] text-center"
                  >
                    Login with X
                  </Link>
                </motion.div>
              </motion.div>

              <div className="lg:flex-1 lg:max-w-md w-full">
                {hasFormspree ? (
                  <WaitlistForm endpoint={rawFormspree} productLabel={title} />
                ) : (
                  <FormspreeMissingNotice productLabel={title} />
                )}
              </div>
            </motion.div>

            <motion.p variants={bulletItemVariants} className="text-xs sm:text-sm text-gray-500 mt-6 max-w-2xl mx-auto">
              <span className="xf-disclaimer-emphasis">Not financial advice.</span> Not a solicitation. Options involve risk
              of loss. For qualified HNWI and trusted-family evaluating software-assisted workflows only.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
