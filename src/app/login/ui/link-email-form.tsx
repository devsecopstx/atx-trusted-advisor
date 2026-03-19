"use client";

import { FormEvent, useState } from "react";

type LinkEmailFormProps = {
  /** X handle from pending-link cookie (server-read); confirms which account is being linked. */
  xHandle?: string;
};

export function LinkEmailForm({ xHandle }: LinkEmailFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Enter your email to link your X login.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Linking email...");
    const response = await fetch("/api/auth/link-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      redirectTo?: string;
      error?: string;
    };
    if (!response.ok || !payload.ok) {
      setStatus(payload.error ?? "Failed to link email");
      return;
    }
    window.location.href = payload.redirectTo ?? "/admin";
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      {xHandle ? (
        <p className="status-text">
          Linking X <strong>@{xHandle}</strong> — enter <em>your</em> email (not another user&apos;s).
        </p>
      ) : null}
      <input
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
        required
        type="email"
        value={email}
      />
      <button className="cta cta-secondary" type="submit">
        Link email and continue
      </button>
      <p className="status-text">{status}</p>
    </form>
  );
}
