import type { Metadata } from "next";

import { LoginPageHeader } from "../login/ui/login-page-header";

import { SignupForm } from "./ui/signup-form";

export const metadata: Metadata = {
  title: "Create your aTx Trusted Advisor account",
  description:
    "Create your aTx Trusted Advisor workspace account — username, email, and password. Approved by an admin before sign-in."
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <LoginPageHeader />
        <SignupForm />
      </div>
    </div>
  );
}
