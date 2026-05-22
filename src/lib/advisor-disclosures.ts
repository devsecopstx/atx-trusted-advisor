/** Current advisor-role AI / algorithmic disclosure bundle (versioned for audit). */
export const ADVISOR_AI_DISCLOSURE_VERSION = "2026-05-advisor-v1" as const;

export type AdvisorAiDisclosureVersion = typeof ADVISOR_AI_DISCLOSURE_VERSION;

/** Compact chip / banner copy for advisor surfaces. */
export const ADVISOR_AI_DISCLOSURE_SHORT =
  "AI-assisted analysis — algorithmic outputs may be incomplete or outdated. You remain responsible for suitability and client disclosures.";

/** Full disclosure shown during advisor compliance onboarding. */
export const ADVISOR_AI_DISCLOSURE_FULL = [
  "xFinance uses artificial intelligence and algorithmic models (including third-party LLMs) to generate illustrative analysis, scans, and structured recommendations.",
  "AI outputs can be wrong, incomplete, or stale. They do not constitute personalized investment advice from ATX Finance Advisory LLC.",
  "Licensed Investment Advisors using this platform remain solely responsible for knowing their client, assessing suitability, and delivering required disclosures before any recommendation or trade.",
  "The platform does not execute trades, does not establish an advisory relationship with your end clients, and does not replace your firm's written supervisory procedures.",
  "Review all outputs with professional judgment. Do not rely on AI-generated content as the sole basis for investment decisions."
].join("\n\n");

/** Attestation text the advisor must accept once per profile completion. */
export const ADVISOR_ATTESTATION_TEXT =
  "I confirm that I am a licensed Investment Advisor or supervised representative authorized by my firm to use decision-support technology with clients, and I will not present AI-generated content as guaranteed or unsupervised advice.";

export type AdvisorDisclosureBundle = {
  version: AdvisorAiDisclosureVersion;
  short: string;
  full: string;
  attestationText: string;
};

export function getCurrentAdvisorDisclosureBundle(): AdvisorDisclosureBundle {
  return {
    version: ADVISOR_AI_DISCLOSURE_VERSION,
    short: ADVISOR_AI_DISCLOSURE_SHORT,
    full: ADVISOR_AI_DISCLOSURE_FULL,
    attestationText: ADVISOR_ATTESTATION_TEXT
  };
}
