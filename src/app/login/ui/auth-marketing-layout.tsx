import Image from "next/image";
import type { ReactNode } from "react";

const SKYLINE = "/branding/atx-skyline-night.png";

export function AuthMarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--xf-bg-900)] text-[var(--xf-text-100)] lg:flex-row">
      <section className="relative order-2 flex w-full flex-1 flex-col justify-center lg:order-1 lg:max-w-[min(560px,48vw)] lg:flex-none lg:basis-[47%]">
        {children}
      </section>
      <section
        className="relative order-1 h-[min(42vh,300px)] w-full shrink-0 overflow-hidden sm:h-[min(40vh,320px)] lg:order-2 lg:h-auto lg:min-h-screen lg:flex-1"
        aria-hidden
      >
        <Image
          src={SKYLINE}
          alt=""
          width={1536}
          height={672}
          priority
          className="h-full w-full object-cover object-[center_28%] lg:min-h-screen lg:object-right"
          sizes="(max-width: 1024px) 100vw, 52vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--xf-bg-900)] via-[color-mix(in_srgb,var(--xf-bg-900)_78%,transparent)] to-[color-mix(in_srgb,var(--xf-bg-900)_35%,transparent)] lg:bg-gradient-to-l lg:from-[var(--xf-bg-900)] lg:via-[color-mix(in_srgb,var(--xf-bg-900)_58%,transparent)] lg:to-[color-mix(in_srgb,var(--xf-bg-900)_12%,transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--xf-bg-900)_22%,transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color-mix(in_srgb,var(--xf-gain-green)_7%,transparent)] via-transparent to-[color-mix(in_srgb,var(--xf-lightning-yellow)_5%,transparent)]" />
      </section>
    </div>
  );
}
