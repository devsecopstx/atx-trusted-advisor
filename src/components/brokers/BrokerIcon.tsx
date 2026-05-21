"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import {
    BROKER_BRAND_COLORS,
    renderBrokerBrandMark,
    type BrokerBrandSlug
} from "@/components/brokers/broker-brand-icons";

interface BrokerIconProps {
  broker: BrokerBrandSlug;
  size?: number;
  className?: string;
  showTooltip?: boolean;
  tooltipVariant?: "simple" | "rich";
  tooltipPosition?: "top" | "bottom";
  connected?: boolean;
}

const brokerData = {
  fidelity: {
    name: "Fidelity",
    fullName: "Fidelity Investments",
    description: "Full-service brokerage · Retirement & options leader",
    color: BROKER_BRAND_COLORS.fidelity.primary
  },
  etrade: {
    name: "E*TRADE",
    fullName: "E*TRADE from Morgan Stanley",
    description: "Active trading · Powerful options platform",
    color: BROKER_BRAND_COLORS.etrade.primary
  },
  forge: {
    name: "Forge Global",
    fullName: "Forge Global",
    description: "Private market & pre-IPO shares",
    color: BROKER_BRAND_COLORS.forge.ring
  },
  hiive: {
    name: "Hiive",
    fullName: "Hiive",
    description: "Pre-IPO marketplace for private company shares",
    color: BROKER_BRAND_COLORS.hiive.primary
  },
  ibkr: {
    name: "IBKR",
    fullName: "Interactive Brokers",
    description: "Global execution · Lowest cost pro platform",
    color: BROKER_BRAND_COLORS.ibkr.primary
  },
  merrill: {
    name: "Merrill Edge",
    fullName: "Merrill Edge",
    description: "Bank of America · Wealth management + trading",
    color: BROKER_BRAND_COLORS.merrill.primary
  }
} as const;

export const BrokerIcon = ({
  broker,
  size = 28,
  className = "",
  showTooltip = true,
  tooltipVariant = "rich",
  tooltipPosition = "top",
  connected = false
}: BrokerIconProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const data = brokerData[broker];

  return (
    <div
      className={`group relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      role="img"
      aria-label={data.fullName}
      title={data.fullName}
    >
      <div className="relative shrink-0 leading-none">
        {renderBrokerBrandMark(broker, { size, title: data.fullName })}

        {connected ? (
          <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0A0A0A]" />
        ) : null}
      </div>

      <AnimatePresence>
        {showTooltip && isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: tooltipPosition === "top" ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: tooltipPosition === "top" ? 6 : -6, scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute z-[60] min-w-[240px] rounded-2xl border border-white/10 bg-[#0A0A0A]/95 px-4 py-3.5 shadow-[0_20px_70px_-15px_rgb(0,0,0)] backdrop-blur-2xl ${
              tooltipPosition === "top" ? "bottom-full mb-3" : "top-full mt-3"
            } left-1/2 -translate-x-1/2`}
          >
            {tooltipVariant === "simple" ? (
              <div className="text-sm font-semibold tracking-tight text-white">{data.fullName}</div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-tight text-white">{data.fullName}</span>
                  {connected ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      Connected
                    </span>
                  ) : null}
                </div>
                <p className="pr-2 text-xs leading-snug text-zinc-400">{data.description}</p>
              </div>
            )}

            <div
              className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border border-white/10 bg-[#0A0A0A] ${
                tooltipPosition === "top" ? "bottom-[-6px]" : "top-[-6px]"
              }`}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
