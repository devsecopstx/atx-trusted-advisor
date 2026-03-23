"use client";

import { useForm, ValidationError } from "@formspree/react";
import { motion } from "framer-motion";
import Link from "next/link";

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const heroLeadVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const bulletContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.16,
      delayChildren: 0.5,
    },
  },
};

const bulletItemVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const ctaRowVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.15, staggerChildren: 0.12 },
  },
};

const ctaItemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const ctaHoverTap = {
  rest: { scale: 1 },
  hover: { scale: 1.03, transition: { duration: 0.2 } },
  tap: { scale: 0.98 },
};

export type HeroProps = {
  formspreeEndpoint?: string;
  /** Product name shown in the H1 (e.g. xoptions). */
  title?: string;
  /** Shown for waitlist questions; mailto link. */
  contactEmail?: string;
};

export default function Hero({
  formspreeEndpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "",
  title = "xoptions",
  contactEmail = "sperezintexas@gmail.com",
}: HeroProps) {
  const [state, handleSubmit] = useForm(formspreeEndpoint);
  const showSuccess = state.succeeded;

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

      <div
        className="absolute right-[8%] top-[12%] h-24 w-24 md:h-32 md:w-32 pointer-events-none opacity-[0.18] md:opacity-[0.22]"
        aria-hidden
      >
        <svg viewBox="0 0 64 64" className="h-full w-full text-amber-300/90 drop-shadow-[0_0_28px_rgba(250,204,21,0.45)]">
          <path fill="currentColor" d="M38 4L14 36h16l-6 24 28-36H36l6-20z" />
        </svg>
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={pageVariants}>
            <motion.div variants={bulletItemVariants} className="mb-8">
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-500/90 font-semibold mb-3">
                Options income · Delegated
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white">
                {title}
              </h1>
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
              variants={bulletItemVariants}
              className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              For <strong className="text-gray-200 font-semibold">HNWI</strong> and{" "}
              <strong className="text-gray-200 font-semibold">RIA</strong> desks: structured options income with less
              operational drag. AI prepares vetted wheel, covered-call, and LEAP-style ideas — you review, approve, and
              delegate the rest.
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
                  Broker-ready previews, conservative defaults, and conflict checks — so you spend time on
                  judgment, not busywork. Built for efficiency, not hype.
                </p>
              </motion.div>

              <motion.div
                variants={bulletItemVariants}
                className="bg-gray-900/55 backdrop-blur-sm p-6 rounded-xl border border-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
              >
                <h3 className="text-xl font-bold text-emerald-400 mb-3">Serious portfolios & RIA controls</h3>
                <p className="text-gray-300 text-[15px] leading-relaxed">
                  Sized for large private wealth and RIA practice standards — exports, audit trails, risk alerts, and
                  overrides when you need them.
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              variants={ctaRowVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row justify-center gap-6 mb-8 items-stretch sm:items-start"
            >
              <motion.div variants={ctaItemVariants} className="flex justify-center">
                <motion.div initial="rest" whileHover="hover" whileTap="tap" variants={ctaHoverTap}>
                  <Link
                    href="/api/auth/x/login"
                    className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-5 px-8 sm:px-10 rounded-full text-lg sm:text-xl shadow-lg shadow-emerald-500/20 border border-emerald-400/30"
                  >
                    Get early access
                  </Link>
                </motion.div>
              </motion.div>

              {!showSuccess ? (
                <motion.form
                  variants={ctaItemVariants}
                  onSubmit={handleSubmit}
                  className="w-full max-w-md mx-auto sm:mx-0 flex flex-col text-left"
                >
                  <p className="text-sm text-gray-400 mb-3">
                    Waitlist / inquiries — we respond directly.{" "}
                    <a
                      href={`mailto:${contactEmail}?subject=xoptions%20waitlist`}
                      className="text-emerald-400/90 hover:text-emerald-300 underline underline-offset-2"
                    >
                      {contactEmail}
                    </a>
                  </p>
                  <input type="hidden" name="_subject" value="xoptions waitlist" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Your work email"
                    required
                    className="w-full px-6 py-4 mb-4 bg-gray-900/80 border border-gray-700 rounded-full text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
                  />
                  <ValidationError
                    prefix="Email"
                    field="email"
                    errors={state.errors}
                    className="text-red-400 text-sm mb-2"
                  />

                  <textarea
                    name="message"
                    placeholder="Optional: HNWI vs RIA, AUM band, custodian"
                    rows={2}
                    className="w-full px-6 py-4 mb-4 bg-gray-900/80 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
                  />
                  <motion.div initial="rest" whileHover="hover" whileTap="tap" variants={ctaHoverTap}>
                    <button
                      type="submit"
                      disabled={state.submitting}
                      className="w-full bg-transparent border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500/15 font-bold py-5 px-10 rounded-full text-lg sm:text-xl transition-colors disabled:opacity-50"
                    >
                      {state.submitting ? "Submitting…" : "Join waitlist"}
                    </button>
                  </motion.div>
                </motion.form>
              ) : (
                <motion.div
                  variants={ctaItemVariants}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-emerald-400 font-semibold text-xl self-center"
                >
                  Thanks — we will follow up shortly.
                </motion.div>
              )}
            </motion.div>

            <motion.p variants={bulletItemVariants} className="text-xs sm:text-sm text-gray-500 mt-6 max-w-2xl mx-auto">
              Not financial advice. Not a solicitation. Options involve risk of loss. For qualified HNWI and RIAs
              evaluating software-assisted workflows only.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
