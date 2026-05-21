'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface BrokerIconProps {
  broker: 'fidelity' | 'etrade' | 'forge' | 'hive' | 'ibkr' | 'merrill';
  size?: number;
  className?: string;
  showTooltip?: boolean;
  tooltipVariant?: 'simple' | 'rich';
  tooltipPosition?: 'top' | 'bottom';
  connected?: boolean;
}

const brokerData = {
  fidelity: {
    name: 'Fidelity',
    fullName: 'Fidelity Investments',
    description: 'Full-service brokerage • Retirement & options leader',
    color: '#006044',
  },
  etrade: {
    name: 'E*TRADE',
    fullName: 'E*TRADE from Morgan Stanley',
    description: 'Active trading • Powerful options platform',
    color: '#00A0E3',
  },
  forge: {
    name: 'Forge Global',
    fullName: 'Forge Global',
    description: 'Private market & pre-IPO shares',
    color: '#FF6B00',
  },
  hive: {
    name: 'Hive',
    fullName: 'Hive Finance',
    description: 'Modern brokerage for active investors',
    color: '#00C9A7',
  },
  ibkr: {
    name: 'IBKR',
    fullName: 'Interactive Brokers',
    description: 'Global execution • Lowest cost pro platform',
    color: '#E30613',
  },
  merrill: {
    name: 'Merrill Edge',
    fullName: 'Merrill Edge',
    description: 'Bank of America • Wealth management + trading',
    color: '#003366',
  },
} as const;

export const BrokerIcon = ({
  broker,
  size = 28,
  className = '',
  showTooltip = true,
  tooltipVariant = 'rich',
  tooltipPosition = 'top',
  connected = false,
}: BrokerIconProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const data = brokerData[broker];

  const icons = {
    fidelity: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#006044" />
        <path d="M50 22 L58 38 L74 38 L62 50 L68 66 L50 54 L32 66 L38 50 L26 38 L42 38 Z" fill="white" stroke="#AF8A49" strokeWidth="2" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="#AF8A49" strokeWidth="1.5" />
      </svg>
    ),
    etrade: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#00A0E3" />
        <text x="50" y="62" textAnchor="middle" fill="white" fontSize="42" fontWeight="700">E*</text>
      </svg>
    ),
    forge: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#1A1A1A" />
        <path d="M30 35 L50 25 L70 35 L70 55 L50 75 L30 55 Z" fill="#FF6B00" />
        <text x="50" y="58" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">FG</text>
      </svg>
    ),
    hive: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#00C9A7" />
        <path d="M50 22 L72 35 L72 65 L50 78 L28 65 L28 35 Z" fill="white" />
        <text x="50" y="58" textAnchor="middle" fill="#00C9A7" fontSize="28" fontWeight="700">H</text>
      </svg>
    ),
    ibkr: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E30613" />
        <path d="M32 30 L68 30 L68 50 L50 70 L32 50 Z" fill="white" />
        <circle cx="50" cy="45" r="8" fill="#E30613" />
      </svg>
    ),
    merrill: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#003366" />
        <path d="M35 55 Q50 35 65 55 Q60 70 50 68 Q40 70 35 55" fill="#E8B923" />
        <circle cx="42" cy="48" r="3" fill="#003366" />
        <circle cx="58" cy="48" r="3" fill="#003366" />
        <path d="M38 42 Q42 38 46 42" fill="none" stroke="#003366" strokeWidth="2" />
      </svg>
    ),
  };

  return (
    <div 
      className={`group relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      role="img"
      aria-label={data.fullName}
    >
      <div className="relative">
        {icons[broker]}
        
        {connected && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0A0A0A]" />
        )}
      </div>

      <AnimatePresence>
        {showTooltip && isOpen && (
          <motion.div
            initial={{ opacity: 0, y: tooltipPosition === 'top' ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: tooltipPosition === 'top' ? 6 : -6, scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className={`
              absolute z-[60] min-w-[240px] rounded-2xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-2xl px-4 py-3.5 shadow-[0_20px_70px_-15px_rgb(0,0,0)] 
              ${tooltipPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'}
              left-1/2 -translate-x-1/2
            `}
          >
            {tooltipVariant === 'simple' ? (
              <div className="text-sm font-semibold text-white tracking-tight">{data.fullName}</div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-[15px] tracking-tight">{data.fullName}</span>
                  {connected && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Connected</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-snug pr-2">{data.description}</p>
              </div>
            )}

            <div 
              className={`
                absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#0A0A0A] border border-white/10
                ${tooltipPosition === 'top' ? 'bottom-[-6px]' : 'top-[-6px]'}
              `}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
