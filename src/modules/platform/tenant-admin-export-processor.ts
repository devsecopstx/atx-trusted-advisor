import type { ObjectId } from "mongodb";

import { listAuditEvents } from "@/modules/audit/repository";
import { getTenantByHexId } from "@/modules/identity/repository";
import { bootstrapAuditEventsToCsv } from "@/modules/platform/tenant-bootstrap-audit-csv";
import {
  getTenantExportJobById,
  markTenantExportJobCompleted,
  markTenantExportJobFailed
} from "@/modules/platform/tenant-admin-export-repository";
import type { TenantExportJobArtifact } from "@/modules/platform/tenant-admin-export-types";
import { buildLiveTenantSpecYaml } from "@/modules/platform/tenant-live-spec-export";

const MAX_AUDIT_ROWS = 5000;
/** Keep below BSON doc limits (artifacts embedded on job row). */
const MAX_ARTIFACT_BYTES = 9 * 1024 * 1024;

export async function processTenantExportJob(jobId: ObjectId, tenantId: ObjectId): Promise<void> {
  const job = await getTenantExportJobById({ jobId, tenantId });
  if (!job?._id || job.status !== "running") {
    return;
  }

  try {
    const tenantHex = tenantId.toHexString();
    const tenant = await getTenantByHexId(tenantHex);
    if (!tenant?._id) {
      await markTenantExportJobFailed(jobId, "tenant_not_found");
      return;
    }

    const artifacts: TenantExportJobArtifact[] = [];
    let totalBytes = 0;

    for (const kind of job.kinds) {
      if (kind === "live_spec_yaml") {
        const content = buildLiveTenantSpecYaml(tenant);
        const byteLength = Buffer.byteLength(content, "utf8");
        totalBytes += byteLength;
        if (byteLength > MAX_ARTIFACT_BYTES) {
          throw new Error(`live_spec_yaml exceeds max bytes (${byteLength})`);
        }
        artifacts.push({
          kind,
          filename: `${tenant.slug}-live-spec.yaml`,
          content,
          byteLength
        });
      } else if (kind === "bootstrap_audit_csv") {
        const events = await listAuditEvents({
          entityType: "tenant",
          entityId: tenantHex,
          action: "tenant_provision_bootstrap",
          limit: MAX_AUDIT_ROWS
        });
        const content = bootstrapAuditEventsToCsv(events);
        const byteLength = Buffer.byteLength(content, "utf8");
        totalBytes += byteLength;
        if (byteLength > MAX_ARTIFACT_BYTES) {
          throw new Error(`bootstrap_audit_csv exceeds max bytes (${byteLength})`);
        }
        artifacts.push({
          kind,
          filename: `${tenant.slug}-bootstrap-audit.csv`,
          content,
          byteLength
        });
      }
    }

    if (totalBytes > MAX_ARTIFACT_BYTES * 2) {
      throw new Error("combined artifacts exceed safe limit");
    }

    await markTenantExportJobCompleted(jobId, artifacts);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await markTenantExportJobFailed(jobId, msg);
  }
}
