/**
 * When BFF proxies GET /api/strategy-options to Spring, the JVM chain can be sparse vs Yahoo/Next
 * (few strikes or missing quotes). Below this threshold we fall back to the Next.js Yahoo handler.
 */
export const MIN_OPTION_CHAIN_STRIKES_TRUST_SPRING = 5;

export function shouldTrustSpringStrategyOptionsPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }
  const chain = (data as { optionChain?: unknown }).optionChain;
  return Array.isArray(chain) && chain.length >= MIN_OPTION_CHAIN_STRIKES_TRUST_SPRING;
}
