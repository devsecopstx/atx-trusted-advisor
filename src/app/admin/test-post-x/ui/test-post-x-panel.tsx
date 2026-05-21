"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

import { MarketingXPostingConnectPanel } from "@/app/admin/marketing/ui/marketing-x-posting-connect";

function freshPlaceholder(): string {
  return `[dev] aTx⚡Finance admin test post — ${new Date().toISOString().slice(0, 19)}Z`;
}

type TestPostXPanelProps = {
  returnPath?: string;
};

export function TestPostXPanel({ returnPath = "/admin/delivery-channels?tab=test-post-x" }: TestPostXPanelProps) {
  const [text, setText] = useState(freshPlaceholder);
  const [status, setStatus] = useState("Enter text and send a test post.");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) {
      setStatus("Post text is required.");
      return;
    }
    setBusy(true);
    setStatus("Posting…");
    try {
      await parseJson<{ data: { posted: boolean; platform: string } }>(
        await fetch("/api/admin/marketing/test-post-x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postText: body })
        })
      );
      setStatus("Posted to X using the connected posting account.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Post failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack-gap">
      <MarketingXPostingConnectPanel returnPath={returnPath} />

      <article className="surface-card xf-widget section-card">
        <h3 className="mt-0">Post body</h3>
        <p className="text-sm text-[var(--xf-text-muted)]">
          Uses{" "}
          <code className="rounded bg-[var(--xf-surface-900)] px-1 py-0.5 font-mono text-xs">
            POST /api/admin/marketing/test-post-x
          </code>{" "}
          — same tokens as Marketing (connect below, or legacy <code className="font-mono">X_OAUTH_REFRESH_TOKEN</code>).
        </p>
        <form className="stack-form mt-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-[var(--xf-text-muted)]">Post text (max 8000 chars)</span>
            <textarea
              className="min-h-[140px] rounded border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-900)] px-3 py-2 font-mono text-sm text-[var(--xf-text-secondary)]"
              disabled={busy}
              maxLength={8000}
              onChange={(e) => setText(e.target.value)}
              value={text}
            />
          </label>
          <div className="tool-row flex-wrap">
            <button className="cta cta-primary" disabled={busy} type="submit">
              {busy ? "Posting…" : "Post to X"}
            </button>
            <button
              className="cta cta-secondary"
              disabled={busy}
              type="button"
              onClick={() => setText(freshPlaceholder())}
            >
              Reset placeholder
            </button>
          </div>
        </form>
        <p className="status-text">{status}</p>
      </article>

      <div className="tool-row flex-wrap">
        <Link className="cta cta-secondary" href="/admin/delivery-channels">
          Delivery channels
        </Link>
        <Link className="cta cta-secondary" href="/admin/marketing">
          Marketing scheduler
        </Link>
      </div>
    </section>
  );
}
