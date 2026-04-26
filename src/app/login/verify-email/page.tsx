import Link from "next/link";

import { VerifyEmailClient } from "./verify-email-client";

type VerifyEmailPageProps = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = typeof params.token === "string" ? params.token.trim() : "";

  return (
    <section className="surface-card mx-auto mt-8 max-w-xl p-6">
      <h1 className="text-lg font-semibold text-[var(--xf-text-100)]">Verify your email</h1>
      <p className="mt-2 text-sm text-[var(--xf-text-300)]">
        Confirm your email to finish account activation. This verification link expires in 24 hours.
      </p>
      <VerifyEmailClient token={token} />
      <p className="mt-4 text-sm text-[var(--xf-text-400)]">
        Need a new link?{" "}
        <Link href="/login" className="underline">
          Go to login
        </Link>{" "}
        and sign in to trigger a resend.
      </p>
    </section>
  );
}
