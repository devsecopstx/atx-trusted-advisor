"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { StrategyJobsOrchestratorPanel } from "@/app/xoptions/strategy-jobs-orchestrator-panel";

export function XoptionsStrategyJobsSection() {
  const sp = useSearchParams();
  const router = useRouter();
  const wantAuto = sp.get("strategyJob") === "1";
  const [cleared, setCleared] = useState(false);
  const autoStart = useMemo(() => wantAuto && !cleared, [wantAuto, cleared]);
  const onConsumed = useCallback(() => {
    setCleared(true);
    router.replace("/xoptions", { scroll: false });
  }, [router]);

  return <StrategyJobsOrchestratorPanel autoStartNewJob={autoStart} onAutoStartConsumed={onConsumed} />;
}
