"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LucideSquarePenIcon } from "@/app/ui/lucide-product-icons";
import { XCHAT_PENDING_PROMPT_STORAGE_KEY } from "@/lib/xchat/xchat-pending-prompt";

const EXAMPLES = [
  "add alert TSLA 420 above in my Roth IRA",
  "add alert NVDA 140 below",
  "add alert AMD 175 crosses",
  "list my price alerts"
] as const;

type PortfolioAlertsXchatHeroProps = {
  portfolioId: string;
  portfolioName: string;
};

export function PortfolioAlertsXchatHero({ portfolioId, portfolioName }: PortfolioAlertsXchatHeroProps) {
  const router = useRouter();

  const openComposer = (text: string) => {
    try {
      sessionStorage.setItem(XCHAT_PENDING_PROMPT_STORAGE_KEY, text);
    } catch {
      /* ignore */
    }
    router.push(`/xchat?portfolioId=${encodeURIComponent(portfolioId)}&item=composer`);
  };

  return (
    <motion.section
      className="portfolio-alerts-xchat-hero"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label="xChat natural-language alert management"
    >
      <div className="portfolio-alerts-xchat-hero__inner">
        <div className="portfolio-alerts-xchat-hero__lead">
          <p className="portfolio-alerts-xchat-hero__eyebrow">xChat · natural language</p>
          <h2 className="portfolio-alerts-xchat-hero__title">Manage alerts by voice or text</h2>
          <p className="portfolio-alerts-xchat-hero__copy">
            Premium+ advisor workflows sync here. Ask Grok in plain English — rules persist to{" "}
            <strong>portfolio_price_alerts</strong> (one active rule per symbol per user). Book:{" "}
            <strong>{portfolioName}</strong>.
          </p>
          <div className="portfolio-alerts-xchat-hero__actions">
            <Link
              href={`/xchat?portfolioId=${encodeURIComponent(portfolioId)}&item=composer`}
              className="portfolio-alerts-xchat-hero__cta"
            >
              <span className="portfolio-alerts-xchat-hero__mic" aria-hidden title="Voice where supported">
                🎙
              </span>
              Open xChat composer
            </Link>
            <button type="button" className="portfolio-alerts-xchat-hero__ghost" onClick={() => openComposer(EXAMPLES[0])}>
              <LucideSquarePenIcon className="portfolio-alerts-xchat-hero__ico" aria-hidden />
              Try sample prompt
            </button>
          </div>
        </div>
        <ul className="portfolio-alerts-xchat-hero__examples" aria-label="Example prompts">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button type="button" className="portfolio-alerts-xchat-hero__chip" onClick={() => openComposer(ex)}>
                “{ex}”
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
