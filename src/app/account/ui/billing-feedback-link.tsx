"use client";

import type { ReactNode } from "react";

import { USER_FEEDBACK_OPEN_EVENT } from "@/lib/user-feedback-open-event";

type BillingFeedbackLinkProps = {
  children: ReactNode;
  className?: string;
};

export function BillingFeedbackLink({ children, className }: BillingFeedbackLinkProps) {
  return (
    <button
      type="button"
      className={className ?? "billing-feedback-link"}
      onClick={() => window.dispatchEvent(new CustomEvent(USER_FEEDBACK_OPEN_EVENT))}
    >
      {children}
    </button>
  );
}
