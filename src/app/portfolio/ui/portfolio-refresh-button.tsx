"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type PortfolioRefreshButtonProps = {
  label?: string;
  className?: string;
};

export function PortfolioRefreshButton({ label = "Refresh", className }: PortfolioRefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`cta cta-secondary${className ? ` ${className}` : ""}`}
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      {pending ? "Refreshing…" : label}
    </button>
  );
}
