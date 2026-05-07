"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

type BillingWelcomeToastProps = {
  planLabel: string;
  /** From server-parsed `?billing_welcome=1` so the banner stays visible after the URL is cleaned up. */
  initialVisible: boolean;
};

export function BillingWelcomeToast({ planLabel, initialVisible }: BillingWelcomeToastProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(initialVisible);

  useEffect(() => {
    if (!initialVisible) {
      return;
    }
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing_welcome") !== "1") {
      return;
    }
    params.delete("billing_welcome");
    const qs = params.toString();
    router.replace(`${path}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [initialVisible, router]);

  const message = `Welcome! Your ${planLabel} workspace is ready — start running covered calls or import your portfolio.`;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-live="polite"
          className="pointer-events-auto fixed bottom-6 left-1/2 z-[80] w-[min(100%,22rem)] -translate-x-1/2 px-4 sm:w-[min(100%,28rem)]"
          exit={{ opacity: 0, y: 12 }}
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 14 }}
          role="status"
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="surface-card xf-widget flex flex-col gap-3 rounded-[var(--xf-radius-md)] border border-[color-mix(in_srgb,var(--xf-gain-green)_38%,transparent)] bg-[var(--xf-surface-700)] p-4 shadow-[var(--xf-shadow-card)]">
            <p className="text-sm leading-snug text-[var(--xf-text-100)]">{message}</p>
            <button
              className="self-end text-xs font-semibold uppercase tracking-[0.08em] text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
              type="button"
              onClick={() => setOpen(false)}
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
