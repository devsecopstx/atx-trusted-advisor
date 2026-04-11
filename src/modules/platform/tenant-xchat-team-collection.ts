import type { Db, ObjectId } from "mongodb";

import { getEnv } from "@/lib/env";
import {
    createXaiCollection,
    deleteXaiCollection,
    hasXaiManagementApiKey,
    listXaiCollections
} from "@/lib/xai";
import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";

const NAME_PREFIX = "xfinance-tenant";
const SUFFIX = "xchat-attachments";

/**
 * Stable xAI collection display name for a tenant’s team KB (attachment uploads from xChat).
 * Slug is normalized to lowercase `[a-z0-9-]` for collection_name safety.
 */
export function buildTenantXchatAttachmentsCollectionName(tenantSlug: string): string {
  const raw = tenantSlug.trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const core = safe.length > 0 ? safe.slice(0, 48) : "tenant";
  return `${NAME_PREFIX}-${core}-${SUFFIX}`;
}

export type EnsureTenantTeamXchatAttachmentsCollectionResult = {
  collectionId: string;
  collectionName: string;
  /** Set when ids were already on the tenant row (no API call). */
  skippedReason?: "already_configured";
};

/**
 * When `XAI_TEAM_ID` is unset, infer team scope if the xAI Management API reports **exactly one** distinct
 * `team_id` across listed collections. Use in prod when the env var was never added to Cloud Run.
 */
export async function tryInferSingleXaiTeamIdFromManagementApi(): Promise<string | undefined> {
  if (!hasXaiManagementApiKey()) {
    return undefined;
  }
  try {
    const listed = await listXaiCollections({});
    const ids = [
      ...new Set(
        listed
          .map((c) => c.teamId?.trim())
          .filter((t): t is string => Boolean(t && t.length > 0))
      )
    ];
    if (ids.length === 1) {
      console.info(
        "[tenant/xchat-team-collection] Inferred xAI team_id from collection inventory (set XAI_TEAM_ID to pin):",
        ids[0]
      );
      return ids[0];
    }
    if (ids.length > 1) {
      console.warn(
        "[tenant/xchat-team-collection] Multiple xAI team ids present; set XAI_TEAM_ID on Next so tenant attachment collections can be provisioned",
        { teamIds: ids }
      );
    }
  } catch (error) {
    console.warn("[tenant/xchat-team-collection] Collection list failed (team inference skipped)", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
  return undefined;
}

/**
 * Ensures an xAI **team** collection exists for xChat file attachments, and stores ids on `core_tenants.tenantPreferences`.
 * Idempotent: skips when `xchat_team_attachments_collection_id` is already set, or reuses an existing collection with the same name.
 *
 * **Team id:** uses `XAI_TEAM_ID` when set; otherwise tries {@link tryInferSingleXaiTeamIdFromManagementApi}.
 * If still unset, creates the collection **without** `team_id` (xAI default team) when the API accepts it.
 */
export async function ensureTenantTeamXchatAttachmentsCollection(input: {
  db: Db;
  tenantSlug: string;
  tenantObjectId: ObjectId;
  tenantPreferences?: TenantPreferences | null;
}): Promise<EnsureTenantTeamXchatAttachmentsCollectionResult | null> {
  const existingId = input.tenantPreferences?.xchat_team_attachments_collection_id?.trim();
  if (existingId) {
    return {
      collectionId: existingId,
      collectionName:
        input.tenantPreferences?.xchat_team_attachments_collection_name?.trim() ?? existingId,
      skippedReason: "already_configured"
    };
  }

  if (!hasXaiManagementApiKey()) {
    console.warn(
      "[tenant/xchat-team-collection] XAI_MANAGEMENT_API_KEY missing; skip provisioning team attachments collection"
    );
    return null;
  }

  let teamId = getEnv().XAI_TEAM_ID?.trim() ?? "";
  if (!teamId) {
    teamId = (await tryInferSingleXaiTeamIdFromManagementApi()) ?? "";
  }

  const collectionName = buildTenantXchatAttachmentsCollectionName(input.tenantSlug);
  const description = `xFinance tenant workspace — xChat attachments for ${input.tenantSlug} (team collection).`;

  try {
    const listed = await listXaiCollections(teamId ? { teamId } : {});
    const match = listed.find((c) => (c.name ?? "").trim() === collectionName);
    let collectionId: string;
    let resolvedName: string;
    if (match?.id) {
      collectionId = match.id;
      resolvedName = match.name?.trim() || collectionName;
    } else {
      const createOpts: { teamId?: string; collectionDescription: string } = {
        collectionDescription: description
      };
      if (teamId) {
        createOpts.teamId = teamId;
      } else {
        console.info(
          "[tenant/xchat-team-collection] Creating attachments collection without team_id (xAI default team). Set XAI_TEAM_ID if create fails or you use multiple teams."
        );
      }
      const created = await createXaiCollection(collectionName, createOpts);
      collectionId = created.id;
      resolvedName = created.name;
    }

    const now = new Date();
    await input.db.collection("core_tenants").updateOne(
      { _id: input.tenantObjectId },
      {
        $set: {
          "tenantPreferences.xchat_team_attachments_collection_id": collectionId,
          "tenantPreferences.xchat_team_attachments_collection_name": resolvedName,
          updatedAt: now
        }
      }
    );

    return { collectionId, collectionName: resolvedName };
  } catch (error) {
    console.error("[tenant/xchat-team-collection] provisioning failed (tenant still created)", {
      tenantSlug: input.tenantSlug,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export type DeleteTenantTeamXchatAttachmentsCollectionOutcome =
  | { status: "no_collection_id" }
  | { status: "skipped_no_management_key"; collectionId: string }
  | { status: "deleted"; collectionId: string }
  | { status: "already_absent"; collectionId: string }
  | { status: "failed"; collectionId: string; message: string };

/**
 * Deletes the xAI **team** collection stored on `tenantPreferences.xchat_team_attachments_collection_id`.
 * Run **before** removing `core_tenants`. If `status === "failed"`, abort the tenant row delete and surface the error.
 */
export async function deleteTenantTeamXchatAttachmentsCollection(input: {
  tenantPreferences?: TenantPreferences | null;
}): Promise<DeleteTenantTeamXchatAttachmentsCollectionOutcome> {
  const collectionId = input.tenantPreferences?.xchat_team_attachments_collection_id?.trim() ?? "";
  if (!collectionId) {
    return { status: "no_collection_id" };
  }
  if (!hasXaiManagementApiKey()) {
    console.warn(
      "[tenant/xchat-team-collection] XAI_MANAGEMENT_API_KEY missing; cannot delete team attachments collection",
      { collectionId }
    );
    return { status: "skipped_no_management_key", collectionId };
  }
  try {
    await deleteXaiCollection(collectionId);
    return { status: "deleted", collectionId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();
    if (lowered.includes("404") || lowered.includes("not found")) {
      return { status: "already_absent", collectionId };
    }
    console.error("[tenant/xchat-team-collection] xAI collection delete failed", {
      collectionId,
      message
    });
    return { status: "failed", collectionId, message };
  }
}
