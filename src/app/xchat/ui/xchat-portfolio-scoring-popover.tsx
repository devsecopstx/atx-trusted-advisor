"use client";

import { useEffect, useId, useRef, useState } from "react";

import { PortfolioScoringFactorsReadonlyTable } from "@/app/ui/portfolio-scoring-factors-readonly";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";

type XchatPortfolioScoringFactorsPopoverProps = {
  portfolioId: string;
};

export function XchatPortfolioScoringFactorsPopover({ portfolioId }: XchatPortfolioScoringFactorsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState<PortfolioScoringFactorApi[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const fetchedOkRef = useRef(false);

  useEffect(() => {
    fetchedOkRef.current = false;
    setFactors(null);
    setError(null);
  }, [portfolioId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(e: MouseEvent) {
      const t = e.target;
      if (t instanceof Node && wrapRef.current && !wrapRef.current.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function loadFactors() {
    if (fetchedOkRef.current || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolios/${encodeURIComponent(portfolioId)}`);
      const body = (await res.json().catch(() => ({}))) as {
        data?: { scoringFactors?: PortfolioScoringFactorApi[] };
        error?: string;
      };
      if (!res.ok) {
        fetchedOkRef.current = false;
        setError(body.error ?? `Could not load (${res.status})`);
        setFactors(null);
        return;
      }
      const rows = body.data?.scoringFactors ?? [];
      fetchedOkRef.current = true;
      setFactors(rows);
    } catch {
      fetchedOkRef.current = false;
      setError("Network error");
      setFactors(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="xchat-scoring-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className="xchat-scoring-popover-trigger"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
          void loadFactors();
        }}
      >
        Scoring factors
      </button>
      {open ? (
        <div
          className="xchat-scoring-popover xf-widget"
          id={popoverId}
          role="dialog"
          aria-label="Portfolio scoring factors for this book"
        >
          {loading ? <p className="status-text">Loading…</p> : null}
          {error ? <p className="status-text status-error">{error}</p> : null}
          {!loading && !error && factors && factors.length > 0 ? (
            <PortfolioScoringFactorsReadonlyTable factors={factors} variant="compact" />
          ) : null}
          {!loading && !error && factors && factors.length === 0 ? (
            <p className="status-text">No factors available.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
