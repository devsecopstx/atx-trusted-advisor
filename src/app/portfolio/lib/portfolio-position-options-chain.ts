import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { underlyingQuoteLookupKey } from "@/app/portfolio/lib/holdings-row-metrics";
import { buildPortfolioOptionsChainBuilderHref } from "@/lib/portfolio/portfolio-desk-handoff";
import {
  isValidXoptionsUnderlyingSymbol,
  normalizeXoptionsUnderlyingSymbol
} from "@/lib/xoptions/xoptions-desk-deep-link";

export type PositionOptionsChainContext = {
  underlying: string;
  positionLabel: string;
  initialSide: "call" | "put";
  initialStrike: number | null;
  initialExpiration: string | null;
  fullChainHref: string;
  builderHref: string | null;
};

function formatOptionPositionLabel(p: SerializablePosition & { type: "option" }): string {
  const exp = p.expiration.trim().slice(0, 10);
  const cp = p.optionType === "put" ? "Put" : "Call";
  return `${p.contracts} ${cp} · ${exp} · ${p.strike}`;
}

export function resolvePositionOptionsChainContext(
  position: SerializablePosition,
  portfolioIdHex: string,
  accountIdHex: string
): PositionOptionsChainContext | null {
  if (position.type !== "stock" && position.type !== "option") {
    return null;
  }
  const rawUnderlying = underlyingQuoteLookupKey(position);
  if (!rawUnderlying) {
    return null;
  }
  const underlying = normalizeXoptionsUnderlyingSymbol(rawUnderlying);
  if (!isValidXoptionsUnderlyingSymbol(underlying)) {
    return null;
  }

  const scope = new URLSearchParams({
    portfolioId: portfolioIdHex,
    accountId: accountIdHex,
    symbol: underlying
  });
  const fullChainHref = `/xoptions/full-chain?${scope.toString()}`;

  if (position.type === "stock") {
    return {
      underlying,
      positionLabel: `${underlying} · ${position.shares.toLocaleString("en-US")} shares`,
      initialSide: "call",
      initialStrike: null,
      initialExpiration: null,
      fullChainHref,
      builderHref: null
    };
  }

  const side = position.optionType === "put" ? "put" : "call";
  const expiration = position.expiration.trim().slice(0, 10);
  return {
    underlying,
    positionLabel: `${underlying} · ${formatOptionPositionLabel(position)}`,
    initialSide: side,
    initialStrike: position.strike,
    initialExpiration: expiration || null,
    fullChainHref,
    builderHref: buildPortfolioOptionsChainBuilderHref({
      portfolioIdHex,
      accountIdHex,
      symbol: underlying,
      expiration,
      side,
      strike: position.strike
    })
  };
}

export function isPositionOptionsChainEligible(position: SerializablePosition): boolean {
  return resolvePositionOptionsChainContext(position, "0".repeat(24), "0".repeat(24)) != null;
}
