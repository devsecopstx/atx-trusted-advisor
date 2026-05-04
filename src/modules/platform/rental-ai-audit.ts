import { createAuditEvent } from "@/modules/audit/repository";
import type { RentalAiAuthContext } from "@/modules/platform/rental-ai-auth";

export async function logRentalAiAudit(input: {
  ctx: RentalAiAuthContext;
  correlationId: string;
  action: string;
  tokensUsed?: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createAuditEvent({
      entityType: "rental_ai",
      entityId: input.ctx.tenantId.toHexString(),
      action: input.action,
      actor: { userId: `rental_key:${input.ctx.apiKeyId}` },
      details: {
        correlationId: input.correlationId,
        tenantSlug: input.ctx.tenantSlug,
        ...(input.tokensUsed !== undefined ? { tokensUsed: input.tokensUsed } : {}),
        ...input.details
      }
    });
  } catch (error) {
    console.warn(
      "[rental-ai] audit write failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}
