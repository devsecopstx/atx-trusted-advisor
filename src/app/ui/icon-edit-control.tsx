"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

import { EditIcon } from "@/app/admin/ui/crud-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

function merge(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

export type IconEditVariant =
  | "neutral"
  | "primary-cta"
  | "secondary-cta"
  | "tiny"
  | "watchlist-toolbar";

function buttonVariantClass(v: IconEditVariant): string {
  switch (v) {
    case "neutral":
      return "xf-icon-edit-btn";
    case "primary-cta":
      return "cta cta-primary xf-icon-edit-btn--primary-cta";
    case "secondary-cta":
      return "cta cta-secondary xf-icon-edit-btn--secondary-cta";
    case "tiny":
      return "tiny-button xf-icon-edit-btn--icon-only";
    case "watchlist-toolbar":
      return "xf-watchlist-toolbar-btn xf-icon-edit-btn--watchlist-toolbar";
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

function linkVariantClass(v: "neutral" | "tiny"): string {
  switch (v) {
    case "neutral":
      return "xf-icon-edit-btn";
    case "tiny":
      return merge("tiny-button", "xf-icon-edit-btn--icon-only");
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

export type IconEditButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "title" | "aria-label"
> & {
  label: string;
  variant?: IconEditVariant;
};

export function IconEditButton({
  label,
  variant = "neutral",
  className,
  type = "button",
  ...rest
}: IconEditButtonProps) {
  return (
    <XfHoverHint hint={label}>
      <button
        aria-label={label}
        className={merge(buttonVariantClass(variant), className)}
        type={type}
        {...rest}
      >
        <EditIcon className="crud-icon" />
      </button>
    </XfHoverHint>
  );
}

export type IconEditLinkProps = Omit<
  ComponentProps<typeof Link>,
  "children" | "title" | "aria-label"
> & {
  label: string;
  variant?: "neutral" | "tiny";
};

export function IconEditLink({ label, variant = "neutral", className, ...rest }: IconEditLinkProps) {
  return (
    <XfHoverHint hint={label}>
      <Link aria-label={label} className={merge(linkVariantClass(variant), className)} {...rest}>
        <EditIcon className="crud-icon" />
      </Link>
    </XfHoverHint>
  );
}
