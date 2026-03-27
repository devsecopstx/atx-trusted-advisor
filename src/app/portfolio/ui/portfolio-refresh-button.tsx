"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";

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
      <RefreshIcon className="crud-icon" />
      {pending ? "Refreshing…" : label}
    </button>
  );
}
