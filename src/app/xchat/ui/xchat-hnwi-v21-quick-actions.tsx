"use client";

import { useCallback, useState, type MutableRefObject, type RefObject } from "react";

import { getXchatComposerTextareaMaxPx } from "@/lib/xchat/xchat-composer-textarea-max";
import {
  HNWI_PROMPT_TEMPLATE_V21_SLUGS,
  HNWI_V21_QUICK_ACTION_LABELS,
  type HnwiPromptTemplateV21Slug
} from "@/modules/xchat/prompt-templates-v21-defaults";

export type XchatHnwiV21QuickActionsProps = {
  workspacePortfolioId: string | null | undefined;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  setInput: (v: string) => void;
  hnwiV21SlugForNextAskRef: MutableRefObject<string | null>;
  askInFlight: boolean;
};

export function XchatHnwiV21QuickActions({
  workspacePortfolioId,
  composerRef,
  setInput,
  hnwiV21SlugForNextAskRef,
  askInFlight
}: XchatHnwiV21QuickActionsProps) {
  const [busySlug, setBusySlug] = useState<HnwiPromptTemplateV21Slug | null>(null);

  const applySlug = useCallback(
    async (slug: HnwiPromptTemplateV21Slug) => {
      if (askInFlight || busySlug) {
        return;
      }
      setBusySlug(slug);
      try {
        const q = workspacePortfolioId?.trim()
          ? `?portfolioId=${encodeURIComponent(workspacePortfolioId.trim())}`
          : "";
        const res = await fetch(`/api/app-user/xchat/prompt-template-v21/${encodeURIComponent(slug)}${q}`, {
          credentials: "include"
        });
        const body = (await res.json().catch(() => ({}))) as {
          data?: { composerText?: string };
          error?: string;
        };
        if (!res.ok || !body.data?.composerText) {
          return;
        }
        hnwiV21SlugForNextAskRef.current = slug;
        setInput(body.data.composerText);
        queueMicrotask(() => {
          const el = composerRef.current;
          if (el) {
            el.focus();
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, getXchatComposerTextareaMaxPx())}px`;
          }
        });
      } finally {
        setBusySlug(null);
      }
    },
    [askInFlight, busySlug, composerRef, hnwiV21SlugForNextAskRef, setInput, workspacePortfolioId]
  );

  return (
    <div aria-label="HNWI Desk Report v2.1 quick prompts" className="xchat-hnwi-v21" role="region">
      <div className="xchat-hnwi-v21__heading">HNWI Desk v2.1</div>
      <div className="xchat-hnwi-v21__grid">
        {HNWI_PROMPT_TEMPLATE_V21_SLUGS.map((slug) => {
          const label = HNWI_V21_QUICK_ACTION_LABELS[slug];
          return (
            <button
              key={slug}
              aria-busy={busySlug === slug}
              className="xchat-hnwi-v21__btn"
              disabled={askInFlight || Boolean(busySlug)}
              title={label}
              type="button"
              onClick={() => void applySlug(slug)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
