"use client";

import { useEffect, useState } from "react";

type VerifyEmailClientProps = {
  token: string;
};

export function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token.");
        return;
      }
      setStatus("pending");
      setMessage("Verifying...");
      try {
        const res = await fetch("/api/auth/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!mounted) {
          return;
        }
        if (!res.ok) {
          setStatus("error");
          setMessage(
            payload.error === "already_verified"
              ? "This email is already verified. You can sign in."
              : payload.error === "invalid_or_expired"
                ? "This verification link is invalid or expired."
                : "Could not verify email."
          );
          return;
        }
        setStatus("success");
        setMessage("Email verified. You can now sign in.");
      } catch {
        if (!mounted) {
          return;
        }
        setStatus("error");
        setMessage("Could not verify email.");
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, [token]);

  const cls =
    status === "success"
      ? "text-[var(--xf-gain-green)]"
      : status === "error"
        ? "text-[var(--xf-warning-400)]"
        : "text-[var(--xf-text-300)]";
  return (
    <p className={`mt-4 text-sm ${cls}`} role={status === "error" ? "alert" : "status"}>
      {message}
    </p>
  );
}
