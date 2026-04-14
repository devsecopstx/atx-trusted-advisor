import Link from "next/link";
import { Suspense } from "react";

import { ResetPasswordForm } from "./reset-password-form";

export default function LoginResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)] p-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold mb-2">Reset password</h1>
        <p className="text-sm text-[var(--xf-text-muted)] mb-6">Choose a new password for your account.</p>
        <Suspense fallback={<p className="status-text">Loading…</p>}>
          <ResetPasswordForm />
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
