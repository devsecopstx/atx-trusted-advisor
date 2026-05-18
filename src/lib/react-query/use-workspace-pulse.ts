"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchWorkspacePulse } from "@/lib/react-query/workspace-pulse-api";
import { workspacePulseQueryKeys } from "@/lib/react-query/query-keys";

const WORKSPACE_PULSE_STALE_MS = 60_000;
const WORKSPACE_PULSE_REFETCH_MS = 180_000;

export function useWorkspacePulse(holdingsKey: string) {
  return useQuery({
    queryKey: workspacePulseQueryKeys.pulse(holdingsKey),
    queryFn: () => fetchWorkspacePulse(holdingsKey),
    staleTime: WORKSPACE_PULSE_STALE_MS,
    refetchInterval: WORKSPACE_PULSE_REFETCH_MS
  });
}
