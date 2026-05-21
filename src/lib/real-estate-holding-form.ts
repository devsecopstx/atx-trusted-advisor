import {
    realEstateNetEquityUsd,
    realEstatePropertyTypeValues,
    type RealEstatePositionMetadata,
    type RealEstatePropertyType,
    type RealEstateValuationSource
} from "@/modules/core-admin/types";

export const REAL_ESTATE_HOLDING_DISCLAIMER =
  "Estimated values are user-provided or third-party approximations. For fiduciary advice we apply conservative haircuts and recommend professional appraisals for material decisions.";

export const REAL_ESTATE_PROPERTY_TYPE_LABELS: Record<RealEstatePropertyType, string> = {
  primary_residence: "Primary residence",
  sfr_investment: "Single-family rental",
  multi_family: "Multi-family",
  commercial: "Commercial",
  land: "Land",
  other: "Other"
};

export type RealEstateHoldingFormValues = {
  holdingName: string;
  address: string;
  propertyType: RealEstatePropertyType;
  propertyTypeOther: string;
  currentValueUsd: string;
  valuationDate: string;
  ownershipPct: string;
  mortgageBalanceUsd: string;
  notes: string;
  valuationSource: RealEstateValuationSource;
};

export function defaultRealEstateHoldingFormValues(): RealEstateHoldingFormValues {
  return {
    holdingName: "",
    address: "",
    propertyType: "primary_residence",
    propertyTypeOther: "",
    currentValueUsd: "",
    valuationDate: new Date().toISOString().slice(0, 10),
    ownershipPct: "100",
    mortgageBalanceUsd: "",
    notes: "",
    valuationSource: "user_provided"
  };
}

export function zillowEstimateSearchUrl(address: string): string {
  const q = address.trim();
  if (!q) {
    return "https://www.zillow.com/";
  }
  const slug = q.replace(/,/g, "").replace(/\s+/g, "-");
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}

export function redfinEstimateSearchUrl(address: string): string {
  const q = address.trim();
  if (!q) {
    return "https://www.redfin.com/";
  }
  return `https://www.redfin.com/homes?search=${encodeURIComponent(q)}`;
}

export function parseCurrencyInput(raw: string): number | null {
  const n = Number.parseFloat(raw.replaceAll(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatUsdWhole(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function computeFormNetEquityPreview(values: RealEstateHoldingFormValues): number | null {
  const gross = parseCurrencyInput(values.currentValueUsd);
  if (gross == null || gross <= 0) {
    return null;
  }
  const ownershipPct = Number.parseFloat(values.ownershipPct);
  const mortgage = parseCurrencyInput(values.mortgageBalanceUsd);
  const metadata: RealEstatePositionMetadata = {
    ownershipPct: Number.isFinite(ownershipPct) ? ownershipPct : 100,
    mortgageBalanceUsd: mortgage != null && mortgage > 0 ? mortgage : undefined
  };
  return realEstateNetEquityUsd({ currentValueUsd: gross, metadata });
}

export type RealEstateHoldingFormValidation =
  | { ok: true; payload: RealEstateHoldingPostBody }
  | { ok: false; error: string };

export type RealEstateHoldingPostBody = {
  portfolioId: string;
  accountId: string;
  type: "real_estate";
  holdingName: string;
  currentValueUsd: number;
  lastValuationDate: string;
  valuationSource: RealEstateValuationSource;
  metadata?: RealEstatePositionMetadata;
};

export function validateRealEstateHoldingForm(
  values: RealEstateHoldingFormValues,
  portfolioId: string,
  accountId: string
): RealEstateHoldingFormValidation {
  const holdingName = values.holdingName.trim();
  if (!holdingName) {
    return { ok: false, error: "Holding name is required." };
  }
  const gross = parseCurrencyInput(values.currentValueUsd);
  if (gross == null || gross <= 0) {
    return { ok: false, error: "Current estimated value must be a positive amount." };
  }
  const valuationDate = values.valuationDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valuationDate)) {
    return { ok: false, error: "Valuation date must be YYYY-MM-DD." };
  }
  const ownershipPct = Number.parseFloat(values.ownershipPct);
  if (!Number.isFinite(ownershipPct) || ownershipPct < 0 || ownershipPct > 100) {
    return { ok: false, error: "Ownership % must be between 0 and 100." };
  }
  const mortgage = parseCurrencyInput(values.mortgageBalanceUsd);
  if (mortgage != null && mortgage < 0) {
    return { ok: false, error: "Outstanding mortgage cannot be negative." };
  }
  if (values.propertyType === "other" && !values.propertyTypeOther.trim()) {
    return { ok: false, error: "Describe the property type when Other is selected." };
  }

  const metadata: RealEstatePositionMetadata = {};
  const address = values.address.trim();
  if (address) {
    metadata.address = address;
  }
  metadata.propertyType = values.propertyType;
  if (values.propertyType === "other") {
    metadata.propertyTypeOther = values.propertyTypeOther.trim();
  }
  if (ownershipPct !== 100) {
    metadata.ownershipPct = ownershipPct;
  }
  if (mortgage != null && mortgage > 0) {
    metadata.mortgageBalanceUsd = mortgage;
  }
  const notes = values.notes.trim();
  if (notes) {
    metadata.notes = notes;
  }

  return {
    ok: true,
    payload: {
      portfolioId,
      accountId,
      type: "real_estate",
      holdingName,
      currentValueUsd: gross,
      lastValuationDate: valuationDate,
      valuationSource: values.valuationSource,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    }
  };
}

export function isRealEstatePropertyType(value: string): value is RealEstatePropertyType {
  return (realEstatePropertyTypeValues as readonly string[]).includes(value);
}
