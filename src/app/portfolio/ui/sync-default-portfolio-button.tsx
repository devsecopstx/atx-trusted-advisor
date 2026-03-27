"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SyncArrowsIcon } from "@/app/admin/ui/crud-icons";

type SyncDefaultPortfolioButtonProps = {
  /** Primary CTA on error surfaces; secondary when paired with other links */
  variant?: "primary" | "secondary";
  /** Compact inline rendering for dense toolbars. */
  compact?: boolean;
  /** Optional className for the button. */
  className?: string;
};

export function SyncDefaultPortfolioButton({
  variant = "primary",
  compact = false,
  className
}: SyncDefaultPortfolioButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSync() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/portfolios/default", {
        method: "POST",
        credentials: "include"
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Sync failed (${res.status}). Try again in a moment.`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const cls = variant === "primary" ? "cta cta-primary" : "cta cta-secondary";
  const buttonClassName = `${cls}${className ? ` ${className}` : ""}`;

  if (compact) {
    return (
      <>
        <button className={buttonClassName} disabled={pending} onClick={() => void onSync()} type="button">
          <SyncArrowsIcon className="crud-icon" />
          {pending ? "Syncing…" : "Sync"}
        </button>
        {error ? (
          <p className="status-text status-error" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className="stack-gap" style={{ marginTop: "0.75rem" }}>
      <button className={buttonClassName} disabled={pending} onClick={() => void onSync()} type="button">
        <SyncArrowsIcon className="crud-icon" />
        {pending ? "Syncing…" : "Sync"}
      </button>
      {error ? (
        <p className="status-text status-error" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
