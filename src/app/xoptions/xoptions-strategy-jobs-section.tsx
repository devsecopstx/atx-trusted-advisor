"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StrategyJobsOrchestratorPanel } from "@/app/xoptions/strategy-jobs-orchestrator-panel";

type XoptionsEntitlementsPayload = {
  subscriptionPlan: "basic" | "premium" | "premium_plus";
  hardcoreStrategyJobs: boolean;
};

export function XoptionsStrategyJobsSection() {
  const sp = useSearchParams();
  const router = useRouter();
  const wantAuto = sp.get("strategyJob") === "1";
  const [cleared, setCleared] = useState(false);
  const [entitlements, setEntitlements] = useState<XoptionsEntitlementsPayload | null>(null);
  const autoStart = useMemo(() => wantAuto && !cleared, [wantAuto, cleared]);
  const onConsumed = useCallback(() => {
    setCleared(true);
    router.replace("/xoptions", { scroll: false });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app-user/xoptions/entitlements", { credentials: "include" });
        const json = (await res.json()) as { data?: XoptionsEntitlementsPayload };
        if (cancelled) {
          return;
        }
        if (res.ok && json.data) {
          setEntitlements(json.data);
        } else {
          setEntitlements({ subscriptionPlan: "basic", hardcoreStrategyJobs: false });
        }
      } catch {
        if (!cancelled) {
          setEntitlements({ subscriptionPlan: "basic", hardcoreStrategyJobs: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!wantAuto || !entitlements || entitlements.hardcoreStrategyJobs) {
      return;
    }
    router.replace("/xoptions", { scroll: false });
  }, [entitlements, router, wantAuto]);

  if (!entitlements) {
    return null;
  }

  if (!entitlements.hardcoreStrategyJobs) {
    return (
      <section className="mb-8 rounded-xl border border-[color:var(--xf-border-500)] bg-[color:var(--xf-surface-800)] p-4 text-[color:var(--xf-text-200)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--xf-gain-green)]">
          Hardcore strategy jobs
        </h2>
        <p className="mt-2 text-sm text-[color:var(--xf-text-300)]">
          Available on <strong className="text-[color:var(--xf-gain-green)]">Premium+</strong>. Upgrade to unlock
          guided strategy jobs with artifact output.
        </p>
        <Link className="xoptions-text-link mt-3 inline-block text-sm" href="/account/billing">
          View billing & plans
        </Link>
      </section>
    );
  }

  return <StrategyJobsOrchestratorPanel autoStartNewJob={autoStart} onAutoStartConsumed={onConsumed} />;
}
