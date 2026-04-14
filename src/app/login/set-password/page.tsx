import Link from "next/link";
import { Suspense } from "react";

import { SetPasswordForm } from "./set-password-form";

export default function LoginSetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)] p-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold mb-2">Set your password</h1>
        <p className="text-sm text-[var(--xf-text-muted)] mb-6">
          Your workspace access was approved. Choose a password to finish setup.
        </p>
        <Suspense fallback={<p className="status-text">Loading…</p>}>
          <SetPasswordForm />
        </Suspense>
        <p className="mt-8 text-sm">
          <Link href="/login" className="text-[var(--xf-gain-green)] underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
