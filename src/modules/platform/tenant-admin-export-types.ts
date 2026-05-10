import type { ObjectId } from "mongodb";

export const TENANT_ADMIN_EXPORT_JOBS_COLLECTION = "tenant_admin_export_jobs" as const;

export type TenantExportArtifactKind = "live_spec_yaml" | "bootstrap_audit_csv";

export type TenantExportJobArtifact = {
  kind: TenantExportArtifactKind;
  filename: string;
  /** UTF-8 text (YAML or CSV). */
  content: string;
  byteLength: number;
};

export type TenantExportJobStatus = "pending" | "running" | "completed" | "failed";

export type TenantExportJob = {
  _id?: ObjectId;
  tenantId: ObjectId;
  kinds: TenantExportArtifactKind[];
  status: TenantExportJobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdByUserId: ObjectId;
  error?: string;
  artifacts?: TenantExportJobArtifact[];
};

export const TENANT_EXPORT_ARTIFACT_KINDS: readonly TenantExportArtifactKind[] = [
  "live_spec_yaml",
  "bootstrap_audit_csv"
];
