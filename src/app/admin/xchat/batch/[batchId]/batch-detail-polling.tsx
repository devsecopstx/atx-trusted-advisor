"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 60_000;

type BatchDetailPollingProps = {
  batchId: string;
  isTerminal: boolean;
};

export function BatchDetailPolling({ batchId, isTerminal }: BatchDetailPollingProps) {
  const router = useRouter();
  const [polling, setPolling] = useState(!isTerminal);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const doPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/xchat/batch/${batchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        setLastPollAt(Date.now());
        router.refresh();
      }
    } catch {
      // ignore
    }
  }, [batchId, router]);

  useEffect(() => {
    if (isTerminal) return;
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? 0);
      if (elapsed >= POLL_TIMEOUT_MS) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setPolling(false);
        return;
      }
      void doPoll();
    }, POLL_INTERVAL_MS);
    const t = setTimeout(() => void doPoll(), 0);
    return () => {
      clearTimeout(t);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPolling(false);
    };
  }, [batchId, isTerminal, doPoll]);

  if (isTerminal) return null;

  const handleManualPoll = () => void doPoll();

  return (
    <div className="batch-polling-bar">
      <p className="batch-polling-status">
        {polling ? (
          <>Polling every 15s for responses (up to 60s)…</>
        ) : (
          <>Batch may take longer — check back or poll manually.</>
        )}
      </p>
      <button
        className="cta cta-secondary"
        onClick={handleManualPoll}
        type="button"
        aria-label="Poll for batch results"
      >
        <RefreshIcon className="crud-icon" /> Poll now
      </button>
      {lastPollAt ? (
        <span className="batch-polling-meta">Last poll: {new Date(lastPollAt).toLocaleTimeString()}</span>
      ) : null}
    </div>
  );
}
