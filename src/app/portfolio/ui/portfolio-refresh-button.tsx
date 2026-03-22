"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type PortfolioRefreshButtonProps = {
  label?: string;
};

export function PortfolioRefreshButton({ label = "Refresh" }: PortfolioRefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="cta cta-secondary"
      style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
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
