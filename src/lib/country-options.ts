/**
 * Country list for the public signup form (and any future country-of-residence
 * selectors). Uses ISO 3166-1 alpha-2 codes. Default is `US` to mirror the
 * advisor product target market — the same default tastytrade-style signup
 * flows use.
 *
 * Keep this list short + curated; if we need a comprehensive picker we can
 * swap in a generated dataset later.
 */

export const DEFAULT_COUNTRY_CODE = "US" as const;

export type CountryOption = {
  /** ISO 3166-1 alpha-2 code, uppercase (`US`, `CA`, …). */
  code: string;
  /** Localized-leaning English label shown in the picker. */
  label: string;
};

export const COUNTRY_OPTIONS: ReadonlyArray<CountryOption> = Object.freeze([
  { code: "US", label: "United States of America" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "CH", label: "Switzerland" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "FI", label: "Finland" },
  { code: "DK", label: "Denmark" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "JP", label: "Japan" },
  { code: "SG", label: "Singapore" },
  { code: "HK", label: "Hong Kong SAR" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "IL", label: "Israel" },
  { code: "MX", label: "Mexico" },
  { code: "BR", label: "Brazil" },
  { code: "AR", label: "Argentina" },
  { code: "ZA", label: "South Africa" },
  { code: "IN", label: "India" }
]);

/** Strict normalize-and-validate; falls back to the default when input is not allowlisted. */
export function normalizeCountryCode(input: unknown): string {
  if (typeof input !== "string") {
    return DEFAULT_COUNTRY_CODE;
  }
  const upper = input.trim().toUpperCase();
  return COUNTRY_OPTIONS.some((option) => option.code === upper) ? upper : DEFAULT_COUNTRY_CODE;
}

/** Strict allowlist check (no fallback); returns `null` for unknown values. */
export function parseCountryCode(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const upper = input.trim().toUpperCase();
  return COUNTRY_OPTIONS.some((option) => option.code === upper) ? upper : null;
}

export function countryLabelFor(code: string): string {
  const match = COUNTRY_OPTIONS.find((option) => option.code === code.toUpperCase());
  return match?.label ?? code.toUpperCase();
}
