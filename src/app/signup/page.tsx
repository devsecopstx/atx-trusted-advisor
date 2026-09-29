import type { Metadata } from "next";

import { AuthMarketingLayout } from "../login/ui/auth-marketing-layout";

import { SignupForm } from "./ui/signup-form";

export const metadata: Metadata = {
  title: "Start your 30-day aTx Trusted Advisor trial",
  description:
    "Create your aTx Trusted Advisor account and sign in immediately. Open 30-day guest trial — complete billing anytime."
};

export default function SignupPage() {
  return (
    <AuthMarketingLayout>
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-10 sm:px-8 lg:mx-0 lg:max-w-none lg:px-10 lg:py-14 xl:px-14">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--xf-text-100)] sm:text-[1.65rem]">
            Start your 30-day trial
          </h1>
          <p className="text-sm leading-relaxed text-[var(--xf-text-muted)]">
            Create your account and sign in right away. Billing stays optional until you choose a plan.
          </p>
        </header>
        <SignupForm />
      </div>
    </AuthMarketingLayout>
  );
}
