import type { Db, ObjectId } from "mongodb";

import type { TenantRentalStrategyBias } from "@/modules/platform/tenant-rental-types";
import { getAdvisorDefaultTools } from "@/modules/xchat/types";

export const RENTAL_ADVISOR_PERSONA_PREFIX = "rental-ai-advisor";

export function rentalAdvisorPersonaNameNormalized(tenantSlug: string): string {
  const safe = tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${RENTAL_ADVISOR_PERSONA_PREFIX}-${safe || "tenant"}`;
}

function strategyBiasSystemAppend(bias: TenantRentalStrategyBias): string {
  switch (bias) {
    case "conservative":
      return [
        "\n\n## Rental workspace risk posture: conservative",
        "Prioritize capital preservation, tighter position sizing, and explicit downside scenarios.",
        "Favor defined-risk options structures; avoid aggressive leverage language."
      ].join(" ");
    case "balanced":
      return [
        "\n\n## Rental workspace risk posture: balanced",
        "Balance growth and drawdown control; use standard position-sizing discipline.",
        "Call out tradeoffs clearly when presenting options income or directional structures."
      ].join(" ");
    case "aggressive":
      return [
        "\n\n## Rental workspace risk posture: aggressive",
        "May discuss higher-beta and more concentrated structures while still stating risks.",
        "Keep disclosures and not-financial-advice posture; no guaranteed returns."
      ].join(" ");
    default: {
      const _x: never = bias;
      return _x;
    }
  }
}

const BASE_RENTAL_SYSTEM = [
  "You are a white-labeled xFinance rental advisor persona for an approved tenant workspace.",
  "Users reach you via the rental API; keep answers concise, institutional in tone, and options-aware.",
  "Cite that outputs are not financial advice where material; never claim access to private order flow."
].join(" ");

/**
 * Idempotent: upserts a **published** rental persona row scoped by tenant slug in `nameNormalized`.
 */
export async function ensureRentalAdvisorPersonaForTenant(
  db: Db,
  input: {
    tenantSlug: string;
    strategyBias: TenantRentalStrategyBias;
    xaiModelOverride?: string;
  }
): Promise<ObjectId> {
  const nameNormalized = rentalAdvisorPersonaNameNormalized(input.tenantSlug);
  const name = `Rental AI Advisor (${input.tenantSlug})`;
  const now = new Date();
  const model = (input.xaiModelOverride?.trim() || "grok-4-1-fast-reasoning").slice(0, 128);
  const systemPrompt = `${BASE_RENTAL_SYSTEM}${strategyBiasSystemAppend(input.strategyBias)}`;
  const tools = getAdvisorDefaultTools();

  await db.collection("xchat_personas").updateOne(
    { nameNormalized },
    {
      $setOnInsert: {
        name,
        nameNormalized,
        createdAt: now
      },
      $set: {
        systemPrompt,
        overridePrompt: "",
        model,
        temperature: 0.2,
        enableRag: true,
        defaultScope: "global",
        status: "published",
        isSystem: true,
        publishedAt: now,
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools
        },
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const row = await db.collection("xchat_personas").findOne({ nameNormalized });
  if (!row?._id) {
    throw new Error("rental persona upsert failed");
  }
  return row._id as ObjectId;
}
