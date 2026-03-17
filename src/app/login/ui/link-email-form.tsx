"use client";

import { FormEvent, useState } from "react";

export function LinkEmailForm() {
  const [email, setEmail] = useState("atxbogart@gmail.com");
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
      <input
        onChange={(event) => setEmail(event.target.value)}
        placeholder="your email"
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
