import type { TenantExportJob } from "@/modules/platform/tenant-admin-export-types";

export type TenantExportJobJson = {
  jobId: string;
  tenantId: string;
  kinds: TenantExportJob["kinds"];
  status: TenantExportJob["status"];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdByUserId: string;
  error?: string;
  artifacts?: Array<{ kind: string; filename: string; byteLength: number }>;
};

export function serializeTenantExportJob(job: TenantExportJob): TenantExportJobJson {
  const artifacts = job.artifacts?.map((a) => ({
    kind: a.kind,
    filename: a.filename,
    byteLength: a.byteLength
  }));
  return {
    jobId: job._id?.toHexString() ?? "",
    tenantId: job.tenantId.toHexString(),
    kinds: job.kinds,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    createdByUserId: job.createdByUserId.toHexString(),
    ...(job.error ? { error: job.error } : {}),
    ...(artifacts && artifacts.length > 0 ? { artifacts } : {})
  };
}
