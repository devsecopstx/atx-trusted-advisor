import type { ObjectId } from "mongodb";

import type { AdvisorAiDisclosureVersion } from "@/lib/advisor-disclosures";

export const advisorLicenseTypeValues = [
  "series_7",
  "series_65",
  "series_66",
  "other"
] as const;
export type AdvisorLicenseType = (typeof advisorLicenseTypeValues)[number];

export const advisorFinraRegistrationStatusValues = ["active", "inactive"] as const;
export type AdvisorFinraRegistrationStatus = (typeof advisorFinraRegistrationStatusValues)[number];

/**
 * Per-advisor FINRA / IARD registration row (tenant = one IA firm; advisor users only).
 * Stored in Mongo `advisor_finra_registrations`.
 */
export type AdvisorFinraRegistration = {
  _id?: ObjectId;
  tenantId: ObjectId;
  advisorUserId: ObjectId;
  crdNumber: string;
  licenseType: AdvisorLicenseType;
  /** US state or DC (ISO 3166-2 style alpha-2). */
  jurisdiction: string;
  evidenceUrl?: string | null;
  notes?: string | null;
  status: AdvisorFinraRegistrationStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** Acknowledgments on `core_users.advisorComplianceProfile` — advisor role only. */
export type AdvisorComplianceProfile = {
  complianceContactEmail?: string;
  attestationAccepted: boolean;
  attestationAcceptedAt?: Date;
  aiDisclosureVersionAccepted?: AdvisorAiDisclosureVersion | string;
  aiDisclosureAcceptedAt?: Date;
  updatedAt: Date;
};

export type AdvisorComplianceMissingStep =
  | "attestation"
  | "ai_disclosure"
  | "finra_registration";

export type AdvisorComplianceStatus = {
  enforced: boolean;
  complete: boolean;
  redirectPath: string;
  missingSteps: AdvisorComplianceMissingStep[];
  profile: AdvisorComplianceProfile | null;
  finraRegistrationCount: number;
  tenantFirmName: string | null;
  disclosureVersion: AdvisorAiDisclosureVersion;
};
