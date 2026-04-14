import { AtxFinanceMark, LightningBolt } from "@/app/ui/atxfinance-logo";

export function LoginPageHeader() {
  return (
    <header className="login-page-header space-y-2">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--xf-text-100)] md:text-[1.65rem]">
        <span className="block sm:inline sm:mr-2">Sign in to</span>
        <span className="mt-1 inline-flex items-center gap-1 sm:mt-0">
          <AtxFinanceMark size={30} />
          <LightningBolt size={24} />
          <span className="font-bold text-[var(--xf-text-100)]">Finance</span>
        </span>
      </h1>
      <p className="text-sm leading-relaxed text-[var(--xf-text-muted)]">
        Use Google, X, or the email and password for your approved workspace account.
      </p>
    </header>
  );
}
